import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AuthenticatedRequest,
  Public,
  RequireCustomer,
} from '../../../shared/infrastructure/http/auth.guard';
import { clientIp } from '../../../shared/infrastructure/http/client-ip';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { TOKEN_SERVICE, TokenService } from '../application/ports/token.port';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  /**
   * Alta de cliente.
   *
   * El límite es agresivo (5 por hora y por IP) porque un registro cuesta caro:
   * ~50 ms de Argon2 más varias escrituras. Sin freno, un script podría llenar
   * la base de cuentas basura y, de paso, contaminar el Excel del cliente.
   */
  @Post('register')
  @Public()
  @Throttle({ register: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una cuenta nueva' })
  @ApiResponse({ status: 201, description: 'Cuenta creada; se devuelve sesión iniciada' })
  @ApiResponse({ status: 409, description: 'El correo ya tiene cuenta' })
  async register(@Body() dto: RegisterDto, @Req() request: Request) {
    const result = await this.registerUseCase.execute({
      ...dto,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    return {
      success: true,
      data: {
        customer: {
          id: result.customer.id,
          fullName: result.customer.fullName,
          accountNumber: result.customer.accountNumber,
          email: result.customer.email,
        },
        ...result.tokens,
      },
    };
  }

  /**
   * Inicio de sesión.
   *
   * 10 intentos cada 15 minutos por IP. Es el freno de primera línea; el
   * bloqueo por cuenta (5 fallos → 15 min) es el de segunda, y ese sí resiste a
   * que el atacante rote de IP.
   */
  @Post('login')
  @Public()
  @Throttle({ login: { limit: 10, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con nombre completo o correo' })
  @ApiResponse({ status: 200, description: 'Sesión iniciada' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    const result = await this.loginUseCase.execute({
      identifier: dto.identifier,
      password: dto.password,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    return { success: true, data: result.tokens };
  }

  /** Renovación de sesión. Rota el refresh token y detecta reusos. */
  @Post('refresh')
  @Public()
  @Throttle({ refresh: { limit: 30, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el access token' })
  async refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    const tokens = await this.tokens.rotate(dto.refreshToken, {
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    });

    return { success: true, data: tokens };
  }

  /**
   * Cierre de sesión.
   *
   * Devuelve 204 siempre, incluso si el token ya no existía. Un logout que
   * falla no le sirve de nada al usuario: lo único que importa es que la sesión
   * quede cerrada, y si ya lo estaba, el objetivo está cumplido.
   */
  @Post('logout')
  @RequireCustomer()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.tokens.revoke(dto.refreshToken);
  }

  /** Cierra TODAS las sesiones del cliente en todos sus dispositivos. */
  @Post('logout-all')
  @RequireCustomer()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos' })
  async logoutAll(@Req() request: AuthenticatedRequest) {
    const revoked = await this.tokens.revokeAllForPrincipal(request.principal!.id, 'CUSTOMER');
    return { success: true, data: { sessionsRevoked: revoked } };
  }
}
