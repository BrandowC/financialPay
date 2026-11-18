import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotFoundError } from '../../../shared/domain/errors/domain.error';
import {
  AuthenticatedRequest,
  RequireCustomer,
} from '../../../shared/infrastructure/http/auth.guard';
import { clientIp } from '../../../shared/infrastructure/http/client-ip';
import { SecurityEventRecorder } from '../../../shared/infrastructure/security/security-event.recorder';
import { TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../application/ports/customer.repository';

/**
 * Todo lo que la app móvil puede hacer con la cuenta propia: ver su perfil y
 * eliminarla. (Las metas de ahorro viven en `GoalsController`.)
 *
 * ── Nota de diseño ──────────────────────────────────────────────────────────
 * Todas las rutas usan `request.principal.id` y NUNCA un id que venga en la
 * URL. Si aceptáramos `/customers/:id`, habría que comprobar en cada endpoint
 * que el id coincide con el del token — y el día que a alguien se le olvide,
 * cualquier persona podría leer los datos de cualquier otra. Es la
 * vulnerabilidad número uno del OWASP Top 10 (IDOR), y la forma de eliminarla
 * de raíz es no darle al cliente forma de nombrar a otro.
 */
@ApiTags('Mi cuenta')
@Controller('me')
@RequireCustomer()
export class MeController {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Perfil de la persona autenticada' })
  @ApiResponse({ status: 200, description: 'Datos de la cuenta' })
  async me(@Req() request: AuthenticatedRequest) {
    const customer = await this.customers.findById(request.principal!.id);

    if (!customer) {
      throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');
    }

    return {
      success: true,
      data: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        countryCode: customer.countryCode,
        memberSince: customer.createdAt.toISOString(),
      },
    };
  }

  /**
   * Eliminación de cuenta.
   *
   * Obligatorio para Google Play y App Store en cualquier app que permita
   * crear cuentas. El borrado es real (no un `deleted_at`) y arrastra en
   * cascada perfil, metas, aportes y sesiones.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar mi cuenta y todos mis datos (definitivo)' })
  @ApiResponse({ status: 204, description: 'Cuenta eliminada' })
  async deleteAccount(@Req() request: AuthenticatedRequest): Promise<void> {
    const customerId = request.principal!.id;

    const customer = await this.customers.findById(customerId);
    if (!customer) throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');

    // El registro de seguridad va ANTES del borrado: después, el CASCADE ya
    // habría eliminado los datos y no habría nada que dejar anotado.
    await this.security.record({
      eventType: 'account.deleted_by_user',
      principalId: customerId,
      email: customer.email,
      ip: clientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
      metadata: {},
    });

    await this.tokens.revokeAllForPrincipal(customerId, 'CUSTOMER');
    await this.customers.hardDelete(customerId);
  }
}
