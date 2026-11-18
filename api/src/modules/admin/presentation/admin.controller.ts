import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '../../../shared/domain/errors/domain.error';
import {
  AuthenticatedRequest,
  Public,
  RequireAdmin,
} from '../../../shared/infrastructure/http/auth.guard';
import { clientIp } from '../../../shared/infrastructure/http/client-ip';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import { TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';
import { AdminLoginUseCase } from '../application/admin-login.use-case';
import { ChangeAdminPasswordUseCase } from '../application/change-admin-password.use-case';
import { CustomerQueryService } from '../application/customer-query.service';
import { ExcelExportService } from '../application/excel-export.service';
import { AdminLoginDto, ChangePasswordDto, ListCustomersDto } from './admin.dto';

const ACCESS_COOKIE = 'admin_access_token';
const REFRESH_COOKIE = 'admin_refresh_token';

@ApiTags('Panel administrativo')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminLogin: AdminLoginUseCase,
    private readonly changePassword: ChangeAdminPasswordUseCase,
    private readonly customers: CustomerQueryService,
    private readonly excel: ExcelExportService,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Autenticación ─────────────────────────────────────────────────────────

  /**
   * Por qué los tokens viajan en cookies y no en el cuerpo de la respuesta.
   *
   * El panel se sirve desde el mismo origen que esta API (ver
   * ServeStaticModule en app.module.ts), así que puede usar cookies httpOnly:
   * JavaScript nunca ve el token, por lo que un XSS no tiene nada que robar.
   * La app móvil no usa este endpoint — sigue con `Authorization: Bearer`
   * (ver auth.controller.ts), sin ningún cambio.
   */
  @Post('auth/login')
  @Public()
  @Throttle({ adminLogin: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como administrador' })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminLogin.execute({
      email: dto.email,
      password: dto.password,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    this.setAuthCookies(response, result.tokens);

    return { success: true, data: { admin: result.admin } };
  }

  @Post('auth/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar la sesión del administrador' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedError('Sesión no iniciada', 'NO_SESSION');
    }

    const tokens = await this.tokens.rotate(refreshToken, {
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    this.setAuthCookies(response, tokens);

    return { success: true, data: { expiresIn: tokens.expiresIn } };
  }

  @Post('auth/logout')
  @RequireAdmin()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (refreshToken) {
      await this.tokens.revoke(refreshToken);
    }
    this.clearAuthCookies(response);
  }

  /**
   * "¿Quién soy?" — la cookie de sesión es httpOnly, así que el panel no
   * puede leerla para saber si sigue autenticado tras recargar la página.
   * Este endpoint es la única forma de averiguarlo.
   */
  @Get('auth/me')
  @RequireAdmin()
  @ApiOperation({ summary: 'Datos del administrador autenticado' })
  async me(@Req() request: AuthenticatedRequest) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: request.principal!.id },
      select: { id: true, email: true, fullName: true, role: true },
    });

    if (!admin) throw new NotFoundError('Administrador', 'ADMIN_NOT_FOUND');

    return { success: true, data: admin };
  }

  /**
   * Cambio de contraseña. Cierra todas las sesiones del administrador, así que
   * se limpian también las cookies de esta: hay que volver a entrar.
   */
  @Post('auth/change-password')
  @RequireAdmin()
  @Throttle({ adminPassword: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar la contraseña del administrador' })
  async changeOwnPassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.changePassword.execute({
      adminId: request.principal!.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    this.clearAuthCookies(response);

    // Con cuerpo (y no 204) para que el panel lea la respuesta igual que las demás.
    return { success: true, data: { changed: true } };
  }

  // ── Tablero ───────────────────────────────────────────────────────────────

  @Get('dashboard')
  @RequireAdmin()
  @ApiOperation({ summary: 'Métricas generales: personas, metas y lo ahorrado' })
  async dashboard() {
    return { success: true, data: await this.customers.dashboardStats() };
  }

  // ── Clientes ──────────────────────────────────────────────────────────────

  @Get('customers')
  @RequireAdmin()
  @ApiOperation({ summary: 'Listado paginado de personas registradas, con búsqueda' })
  async list(@Query() query: ListCustomersDto) {
    const result = await this.customers.list({
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      onlyWithGoals: query.onlyWithGoals,
      onlyWithoutGoals: query.onlyWithoutGoals,
      period: query.period,
    });

    return { success: true, data: result.items, meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    } };
  }

  @Get('customers/:id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Ficha de una persona, con el resumen de sus metas' })
  @ApiResponse({ status: 404, description: 'No existe' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customers.findOne(id);
    if (!customer) throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');

    const goals = await this.customers.goalsOf(id);

    return { success: true, data: { ...customer, goals } };
  }

  // ── Exportación ───────────────────────────────────────────────────────────

  /**
   * Descarga de todas las personas registradas en .xlsx.
   *
   * El límite es bajo (3 por hora) porque cada exportación recorre la tabla
   * entera. También es la operación más sensible del panel: se lleva los datos
   * personales de toda la base en un archivo.
   */
  @Get('export/customers.xlsx')
  @RequireAdmin()
  @Throttle({ export: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Descargar en Excel las personas registradas' })
  async exportExcel(@Res() response: Response): Promise<void> {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${ExcelExportService.fileName()}"`,
    );
    // El archivo se genera en streaming, así que no se conoce el tamaño de
    // antemano. Sin esta cabecera algunos proxies intentarían bufferearlo entero.
    response.setHeader('Transfer-Encoding', 'chunked');

    await this.excel.streamToResponse(response);
  }

  // ── Cookies de sesión ───────────────────────────────────────────────────────

  /**
   * `Secure` solo en producción a propósito: en desarrollo el panel corre en
   * `http://localhost`, y una cookie `Secure` sobre HTTP simplemente no se
   * guarda — el login parecería fallar sin ningún error visible. En
   * producción hay HTTPS real (Render lo termina en el borde) y no hay razón
   * para bajar la guardia.
   *
   * `SameSite=Strict` en producción es lo que de verdad detiene CSRF sin
   * ayuda de nadie más: el navegador ni siquiera intenta mandar la cookie en
   * una petición que no haya empezado en el propio sitio. En desarrollo se
   * relaja a `Lax` porque construir contra HTTPS local no vale la pena para
   * un panel interno — y de todos modos `csrf.middleware.ts` sigue activo.
   */
  private cookieOptions(path: string): CookieOptions {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path,
    };
  }

  private get apiPrefixPath(): string {
    return `/${this.config.getOrThrow<string>('API_PREFIX')}`;
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): void {
    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.cookieOptions(this.apiPrefixPath),
      maxAge: tokens.expiresIn * 1000,
    });

    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(`${this.apiPrefixPath}/admin/auth`),
      maxAge: AdminController.parseDurationMs(this.config.getOrThrow<string>('JWT_REFRESH_TTL')),
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, this.cookieOptions(this.apiPrefixPath));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(`${this.apiPrefixPath}/admin/auth`));
  }

  /** "30d" → 2592000000 ms. Ya validado por el esquema de entorno. */
  private static parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) throw new Error(`Duración inválida: ${value}`);

    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

    return amount * multipliers[unit];
  }
}
