/**
 * Jerarquía de errores del dominio.
 *
 * Regla de oro: el dominio NO conoce HTTP. Estas clases no importan nada de
 * NestJS ni de Express. Es el filtro de excepciones de la capa de presentación
 * (`DomainExceptionFilter`) el que traduce cada tipo a un status code.
 *
 * Eso permite reutilizar exactamente los mismos casos de uso desde un worker,
 * un comando de CLI o una cola, sin arrastrar el framework web.
 *
 * Cada error lleva un `code` estable y legible por máquina. El cliente móvil y
 * el panel reaccionan a ESE código, nunca al texto del mensaje: así podemos
 * reescribir los mensajes o traducirlos sin romper a nadie.
 */

export type ErrorMetadata = Record<string, unknown>;

export abstract class DomainError extends Error {
  /** Código estable para el cliente. Ej: 'EMAIL_ALREADY_REGISTERED'. */
  abstract readonly code: string;

  /**
   * Si es seguro mostrar `message` directamente al usuario final.
   * Los errores de infraestructura ponen esto en false para que el filtro
   * devuelva un texto genérico y el detalle solo quede en los logs.
   */
  readonly isSafeToExpose: boolean = true;

  constructor(
    message: string,
    readonly metadata: ErrorMetadata = {},
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    // Sin esto, `instanceof` falla al compilar a ES5 y el filtro no clasifica.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Datos de entrada inválidos según las reglas del negocio. → HTTP 400 */
export class ValidationError extends DomainError {
  readonly code: string;

  constructor(message: string, code = 'VALIDATION_ERROR', metadata: ErrorMetadata = {}) {
    super(message, metadata);
    this.code = code;
  }
}

/** Credenciales ausentes, inválidas o expiradas. → HTTP 401 */
export class UnauthorizedError extends DomainError {
  readonly code: string;

  constructor(message = 'No autorizado', code = 'UNAUTHORIZED', metadata: ErrorMetadata = {}) {
    super(message, metadata);
    this.code = code;
  }
}

/** Autenticado, pero sin permiso para esta acción. → HTTP 403 */
export class ForbiddenError extends DomainError {
  readonly code: string;

  constructor(message = 'Acción no permitida', code = 'FORBIDDEN', metadata: ErrorMetadata = {}) {
    super(message, metadata);
    this.code = code;
  }
}

/** El recurso no existe (o el actor no puede saber que existe). → HTTP 404 */
export class NotFoundError extends DomainError {
  readonly code: string;

  constructor(resource: string, code = 'NOT_FOUND', metadata: ErrorMetadata = {}) {
    super(`${resource} no encontrado`, metadata);
    this.code = code;
  }
}

/** Choque con el estado actual: duplicado, versión obsoleta… → HTTP 409 */
export class ConflictError extends DomainError {
  readonly code: string;

  constructor(message: string, code = 'CONFLICT', metadata: ErrorMetadata = {}) {
    super(message, metadata);
    this.code = code;
  }
}

/** Demasiadas peticiones o cuenta bloqueada temporalmente. → HTTP 429 */
export class RateLimitError extends DomainError {
  readonly code: string;

  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    code = 'RATE_LIMITED',
  ) {
    super(message, { retryAfterSeconds });
    this.code = code;
  }
}

/**
 * Falló un sistema externo (base de datos, Google Sheets, Redis).
 * Nunca se expone el mensaje real: podría contener cadenas de conexión,
 * nombres de host internos o fragmentos de SQL.
 */
export class InfrastructureError extends DomainError {
  readonly code: string;
  readonly isSafeToExpose = false;

  constructor(
    message: string,
    code = 'INFRASTRUCTURE_ERROR',
    cause?: unknown,
    metadata: ErrorMetadata = {},
  ) {
    super(message, metadata, cause);
    this.code = code;
  }
}
