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
import {
  BALANCE_REPOSITORY,
  BalanceRepository,
} from '../../balances/application/ports/balance.repository';
import { TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';
import { CUSTOMER_REPOSITORY, CustomerRepository } from '../application/ports/customer.repository';

/**
 * Todo lo que la app móvil puede hacer con la cuenta propia.
 *
 * ── Nota de diseño ──────────────────────────────────────────────────────────
 * Aquí NO hay ningún endpoint para modificar el saldo. Es intencional y es el
 * requisito del cliente: el usuario entra, ve su valor, y no puede hacer nada
 * más. El único camino para cambiar un saldo pasa por el panel administrativo,
 * autenticado como ADMIN, y queda auditado.
 *
 * Todas las rutas usan `request.principal.id` y NUNCA un id que venga en la
 * URL. Si aceptáramos `/customers/:id/balance`, habría que comprobar en cada
 * endpoint que el id coincide con el del token — y el día que a alguien se le
 * olvide, cualquier cliente podría leer el saldo de cualquier otro. Es la
 * vulnerabilidad número uno del OWASP Top 10 (IDOR), y la forma de eliminarla
 * de raíz es no darle al cliente forma de nombrar a otro.
 */
@ApiTags('Mi cuenta')
@Controller('me')
@RequireCustomer()
export class MeController {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(BALANCE_REPOSITORY) private readonly balances: BalanceRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
  ) {}

  /**
   * Perfil + saldo en UNA sola petición.
   *
   * La pantalla necesita las dos cosas para pintarse. Separarlas en dos
   * endpoints obligaría a la app a hacer dos viajes de red antes de mostrar
   * nada — en una conexión móvil lenta son 600 ms de pantalla en blanco.
   */
  @Get()
  @ApiOperation({ summary: 'Perfil y saldo del cliente autenticado' })
  @ApiResponse({ status: 200, description: 'Datos de la cuenta' })
  async me(@Req() request: AuthenticatedRequest) {
    const customerId = request.principal!.id;

    // En paralelo: son dos consultas independientes y encadenarlas duplicaría
    // la latencia sin ninguna razón.
    const [customer, balance] = await Promise.all([
      this.customers.findById(customerId),
      this.balances.findByUserId(customerId),
    ]);

    if (!customer) {
      throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');
    }

    return {
      success: true,
      data: {
        id: customer.id,
        fullName: customer.fullName,
        accountNumber: customer.accountNumber,
        email: customer.email,
        memberSince: customer.createdAt.toISOString(),
        balance: {
          // Se devuelven las tres formas para que el cliente no tenga que
          // calcular nada: los centavos como cadena (precisión exacta), el
          // decimal para mostrar, y el formateado por si acaso.
          cents: balance?.money.cents.toString() ?? '0',
          decimal: balance?.money.toDecimalString() ?? '0.00',
          formatted: balance?.money.format() ?? '$0.00',
          currency: balance?.money.currency ?? 'USD',
          updatedAt: balance?.updatedAt.toISOString() ?? null,
        },
      },
    };
  }

  /**
   * Eliminación de cuenta.
   *
   * Obligatorio desde 2024 para cualquier app de Google Play que permita crear
   * cuentas. El borrado es real (no un `deleted_at`) y arrastra en cascada
   * perfil, saldo, auditoría y sesiones.
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
      metadata: { accountNumber: customer.accountNumber },
    });

    await this.tokens.revokeAllForPrincipal(customerId, 'CUSTOMER');
    await this.customers.hardDelete(customerId);
  }
}
