import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InfrastructureError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors/domain.error';

/** Forma ÚNICA de todas las respuestas de error de la API. */
export interface ErrorResponseBody {
  /** Siempre false. Permite al cliente distinguir sin mirar el status. */
  success: false;
  error: {
    /** Código estable y legible por máquina. Ej: 'EMAIL_ALREADY_REGISTERED'. */
    code: string;
    /** Texto apto para mostrar al usuario final. */
    message: string;
    /** Errores por campo, solo en validaciones. */
    fields?: Record<string, string[]>;
  };
  meta: {
    /** Para que el usuario pueda decir "me salió el error abc123" y se pueda
     *  encontrar la traza exacta en los logs. */
    requestId: string;
    timestamp: string;
    path: string;
  };
}

/**
 * Filtro global de excepciones.
 *
 * ── Qué problema resuelve ───────────────────────────────────────────────────
 * Sin él, cada capa decide por su cuenta qué devolver: unos endpoints mandan
 * `{error: "..."}`, otros `{message: "..."}`, y una excepción no capturada se
 * convierte en un 500 con el stack trace dentro. Ese stack trace revela rutas
 * del servidor, versiones de librerías y a veces fragmentos de SQL — es
 * reconocimiento gratis para un atacante.
 *
 * Con este filtro hay una sola forma de respuesta, un solo lugar donde se
 * decide qué se expone, y el detalle real queda solo en los logs.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ??
      (request as Request & { id?: string }).id ??
      'sin-id';

    const { status, code, message, fields } = this.classify(exception);

    const body: ErrorResponseBody = {
      success: false,
      error: { code, message, ...(fields ? { fields } : {}) },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    this.log(exception, status, code, requestId, request);

    // 429 debe indicar cuándo reintentar; sin esta cabecera el cliente móvil
    // no sabe cuánto esperar y suele reintentar de inmediato, empeorando todo.
    if (exception instanceof RateLimitError) {
      response.setHeader('Retry-After', exception.retryAfterSeconds);
    }

    response.status(status).json(body);
  }

  /** Traduce cualquier excepción a (status, código, mensaje) seguros. */
  private classify(exception: unknown): {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  } {
    // ── 1. Errores del dominio ────────────────────────────────────────────
    if (exception instanceof DomainError) {
      const status = this.statusForDomainError(exception);

      return {
        status,
        code: exception.code,
        // Los errores de infraestructura nunca muestran su mensaje real.
        message: exception.isSafeToExpose
          ? exception.message
          : 'Ocurrió un problema en el servidor. Intenta de nuevo en unos minutos.',
      };
    }

    // ── 2. Rate limiting del framework ────────────────────────────────────
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: 'RATE_LIMITED',
        message: 'Demasiados intentos. Espera un momento y vuelve a intentar.',
      };
    }

    // ── 3. Errores de validación de DTOs (class-validator) ────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (status === HttpStatus.BAD_REQUEST && typeof payload === 'object' && payload !== null) {
        const raw = (payload as { message?: unknown }).message;

        if (Array.isArray(raw)) {
          return {
            status,
            code: 'VALIDATION_ERROR',
            message: 'Revisa los datos enviados.',
            fields: this.groupValidationMessages(raw as string[]),
          };
        }
      }

      return {
        status,
        code: this.codeForStatus(status),
        message:
          typeof payload === 'string'
            ? payload
            : ((payload as { message?: string }).message ?? exception.message),
      };
    }

    // ── 4. Errores de Prisma que se escaparon del repositorio ─────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE_RESOURCE',
          message: 'Ese registro ya existe.',
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'No se encontró el recurso solicitado.',
        };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Casi siempre es un bug nuestro, no del cliente. 500 y a los logs.
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un problema en el servidor.',
      };
    }

    // ── 5. Lo desconocido ─────────────────────────────────────────────────
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un problema inesperado. Ya fue reportado a nuestro equipo.',
    };
  }

  private statusForDomainError(error: DomainError): number {
    // instanceof en cascada en vez de un mapa por nombre de clase: sobrevive a
    // la minificación y a que alguien renombre una clase.
    if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
    if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
    if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof ConflictError) return HttpStatus.CONFLICT;
    if (error instanceof RateLimitError) return HttpStatus.TOO_MANY_REQUESTS;
    if (error instanceof InfrastructureError) return HttpStatus.SERVICE_UNAVAILABLE;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }

  /**
   * class-validator devuelve un array plano de frases. Se agrupan por campo
   * para que el formulario pueda pintar el error debajo del input correcto en
   * vez de mostrar un banner genérico.
   */
  private groupValidationMessages(messages: string[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const raw of messages) {
      // Los mensajes de class-validator empiezan por el nombre de la propiedad.
      const field = raw.split(' ')[0] ?? '_';
      (grouped[field] ??= []).push(raw);
    }

    return grouped;
  }

  private log(
    exception: unknown,
    status: number,
    code: string,
    requestId: string,
    request: Request,
  ): void {
    const context = {
      requestId,
      method: request.method,
      path: request.url,
      status,
      code,
      ip: request.ip,
    };

    if (status >= 500) {
      // Solo aquí se guarda el stack completo, y solo del lado del servidor.
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(context),
      );
      return;
    }

    if (status === 401 || status === 403 || status === 429) {
      // Interesan para detectar ataques: se registran aunque no sean fallos.
      this.logger.warn(`${request.method} ${request.url} → ${status} ${code}`, JSON.stringify(context));
      return;
    }

    if (!this.isProduction) {
      this.logger.debug(`${request.method} ${request.url} → ${status} ${code}`);
    }
  }
}
