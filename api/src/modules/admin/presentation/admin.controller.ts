import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
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
import { UpdateBalanceDto } from '../../auth/presentation/auth.dto';
import { TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';
import {
  BALANCE_REPOSITORY,
  BalanceRepository,
} from '../../balances/application/ports/balance.repository';
import { UpdateBalanceUseCase } from '../../balances/application/use-cases/update-balance.use-case';
import { AdminLoginUseCase } from '../application/admin-login.use-case';
import { CustomerQueryService } from '../application/customer-query.service';
import { ExcelExportService } from '../application/excel-export.service';
import { AdminLoginDto, ListCustomersDto } from './admin.dto';

const ACCESS_COOKIE = 'admin_access_token';
const REFRESH_COOKIE = 'admin_refresh_token';

@ApiTags('Panel administrativo')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminLogin: AdminLoginUseCase,
    private readonly customers: CustomerQueryService,
    private readonly updateBalance: UpdateBalanceUseCase,
    private readonly excel: ExcelExportService,
    @Inject(BALANCE_REPOSITORY) private readonly balances: BalanceRepository,
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

  // ── Tablero ───────────────────────────────────────────────────────────────

  @Get('dashboard')
  @RequireAdmin()
  @ApiOperation({ summary: 'Métricas generales y estado de la sincronización' })
  async dashboard() {
    return { success: true, data: await this.customers.dashboardStats() };
  }

  // ── Clientes ──────────────────────────────────────────────────────────────

  @Get('customers')
  @RequireAdmin()
  @ApiOperation({ summary: 'Listado paginado de clientes con búsqueda' })
  async list(@Query() query: ListCustomersDto) {
    const result = await this.customers.list({
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      onlyWithBalance: query.onlyWithBalance,
      onlyWithoutBalance: query.onlyWithoutBalance,
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
  @ApiOperation({ summary: 'Ficha de un cliente' })
  @ApiResponse({ status: 404, description: 'No existe' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customers.findOne(id);
    if (!customer) throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');

    return { success: true, data: customer };
  }

  /**
   * LA operación del panel: cambiar el valor de un cliente.
   *
   * Es PATCH y no PUT porque solo modifica el saldo, no reemplaza el recurso
   * completo. Y exige `expectedVersion` en el cuerpo: sin ese dato la petición
   * se rechaza, así que es imposible sobrescribir a ciegas el cambio de otro
   * administrador.
   */
  @Patch('customers/:id/balance')
  @RequireAdmin()
  @Throttle({ balanceUpdate: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Actualizar el saldo de un cliente' })
  @ApiResponse({ status: 200, description: 'Saldo actualizado' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso de escritura' })
  @ApiResponse({ status: 409, description: 'Otro administrador cambió el saldo primero' })
  async setBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBalanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const principal = request.principal!;

    const result = await this.updateBalance.execute({
      customerId: id,
      amount: dto.amount,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason,
      actor: {
        id: principal.id,
        // El correo no viaja en el token (se mantiene mínimo), así que se lee
        // de la ficha del administrador para la auditoría.
        email: await this.adminEmail(principal.id),
        role: (principal.role ?? 'OPERATOR') as 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER',
      },
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    return {
      success: true,
      data: {
        changed: result.changed,
        previous: result.previous.toDecimalString(),
        current: result.balance.money.toDecimalString(),
        formatted: result.balance.money.format(),
        version: result.balance.version,
        updatedAt: result.balance.updatedAt.toISOString(),
      },
    };
  }

  @Get('customers/:id/history')
  @RequireAdmin()
  @ApiOperation({ summary: 'Historial de cambios de saldo de un cliente' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const safePage = Math.max(page, 1);

    const [entries, total] = await Promise.all([
      this.balances.findHistory(id, safePageSize, (safePage - 1) * safePageSize),
      this.balances.countHistory(id),
    ]);

    return {
      success: true,
      data: entries.map((e) => ({
        id: e.id,
        previous: e.previous.toDecimalString(),
        current: e.current.toDecimalString(),
        delta: e.deltaCents,
        changedBy: e.changedByEmail,
        reason: e.reason,
        at: e.createdAt.toISOString(),
      })),
      meta: { total, page: safePage, pageSize: safePageSize },
    };
  }

  // ── Exportación ───────────────────────────────────────────────────────────

  /**
   * Descarga de todos los clientes en .xlsx.
   *
   * El límite es bajo (3 por hora) porque cada exportación recorre la tabla
   * entera. También es la operación más sensible del panel: se lleva los datos
   * personales de toda la base en un archivo, así que queda registrada.
   */
  @Get('export/customers.xlsx')
  @RequireAdmin()
  @Throttle({ export: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Descargar en Excel los clientes registrados en los últimos 8 días' })
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

  /**
   * Historial completo de registros, incluidas las cuentas ya eliminadas.
   *
   * Es un endpoint aparte de `export/customers.xlsx` a propósito: aquél lee
   * de las tablas vivas (últimos 8 días, con saldo y estado); este lee de
   * `registration_ledger`, un registro permanente que no se borra ni se
   * actualiza jamás — por eso no lleva saldo ni estado, esos datos dejan de
   * existir cuando la cuenta se borra.
   */
  @Get('export/registrations.xlsx')
  @RequireAdmin()
  @Throttle({ exportLedger: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Descargar el historial completo de registros (incluye cuentas eliminadas)' })
  async exportRegistrations(@Res() response: Response): Promise<void> {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${ExcelExportService.ledgerFileName()}"`,
    );
    response.setHeader('Transfer-Encoding', 'chunked');

    await this.excel.streamRegistrationLedgerToResponse(response);
  }

  /** El token no lleva el correo (se mantiene mínimo), así que se lee aquí. */
  private async adminEmail(adminId: string): Promise<string> {
    const found = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { email: true },
    });
    return found?.email ?? 'desconocido';
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
