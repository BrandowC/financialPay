import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';

/**
 * Punto de entrada.
 *
 * Aquí se decide todo lo que aplica a CADA petición: seguridad de cabeceras,
 * CORS, compresión, validación, formato de errores y apagado limpio.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // El buffer retiene los logs del arranque hasta que el logger definitivo
    // esté listo; sin esto se pierden justo los mensajes de los errores de
    // configuración, que son los que más falta hacen.
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  /**
   * ── trust proxy ──────────────────────────────────────────────────────────
   * En producción hay un balanceador delante (Railway, Render, Nginx…). Sin
   * esta línea, `request.ip` sería la del proxy —la misma para todos— y el rate
   * limiting por IP bloquearía a todos los usuarios a la vez.
   *
   * El valor es 1, no `true`. Con `true`, Express se cree la primera IP de
   * X-Forwarded-For, que la escribe el cliente y por tanto puede falsificarse
   * para saltarse los límites. Con 1 cuenta exactamente un proxy de confianza.
   * Si en su despliegue hubiera dos (por ejemplo Cloudflare + Render), hay que
   * poner 2.
   */
  app.set('trust proxy', 1);

  /**
   * ── Cabeceras de seguridad ───────────────────────────────────────────────
   * La CSP SÍ importa ahora: desde que el panel administrativo se sirve como
   * HTML estático en `/admin` (ver ServeStaticModule en app.module.ts), esto
   * dejó de ser "una API que solo devuelve JSON". Una política estricta
   * (todo `'self'`) limita el daño si algún día se cuela un script ajeno.
   *
   * `scriptSrc` necesita `'unsafe-inline'` porque el export estático de Next
   * (ver admin/next.config.ts) incrusta scripts inline para hidratar la
   * página (el payload de React Server Components) — no es opcional, Next lo
   * genera así en cualquier export estático. Sin `nonce`/`hash` por petición
   * (imposible aquí: son archivos estáticos servidos tal cual, sin plantilla
   * del lado del servidor) esta es la única forma de que el panel cargue. La
   * mitigación real contra XSS sigue siendo la misma de siempre: React
   * escapa el contenido por defecto y el panel no usa
   * `dangerouslySetInnerHTML` en ninguna parte. Swagger UI (fuera de
   * producción) también necesita estilos e imágenes inline.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  /**
   * ── Cookies ──────────────────────────────────────────────────────────────
   * Solo las usa el panel administrativo (ver admin.controller.ts): la app
   * móvil sigue autenticándose con `Authorization: Bearer` sin tocar cookies
   * para nada.
   */
  app.use(cookieParser());

  /**
   * ── Identificador de petición ────────────────────────────────────────────
   * Cada petición recibe un id que viaja en los logs y en la respuesta de
   * error. Cuando el cliente dice "me salió un error", ese id lleva
   * directamente a la traza exacta en vez de a media hora de búsqueda.
   */
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && incoming.length < 100 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  /**
   * ── CORS ─────────────────────────────────────────────────────────────────
   * La app móvil no manda cabecera Origin (no es un navegador), así que esto
   * afecta sobre todo al panel administrativo. La lista viene del entorno y en
   * producción el esquema prohíbe comodines y localhost.
   *
   * ── Por qué esto también es la defensa CSRF del panel ───────────────────
   * Desde que el panel usa cookies de sesión (ver admin.controller.ts), hacía
   * falta protección contra CSRF: un sitio ajeno que induzca al navegador del
   * administrador a mandar una petición con su cookie puesta. La función de
   * `origin` de abajo NO es un simple filtro de conveniencia del navegador —
   * cuando el origen no está en la lista, llama a `callback(error, false)`, y
   * eso corta la petición AQUÍ, en el servidor, antes de llegar a ningún
   * controlador. Un navegador que manda `Origin: https://sitio-ajeno.com`
   * (cosa que SIEMPRE hace en POST/PATCH/DELETE, y que no se puede falsificar
   * desde JavaScript) nunca llega a ejecutar nada, tenga o no la cookie
   * puesta. Por eso el propio origen del panel DEBE estar en `CORS_ORIGINS`
   * (ver el comentario en .env.example) — si no lo está, se autobloquea.
   */
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Sin Origin = app móvil, curl o petición servidor-a-servidor. Se permite:
      // el token es lo que autoriza, no el origen.
      if (!origin) return callback(null, true);

      if (origins.includes(origin)) return callback(null, true);

      logger.warn(`CORS rechazado para el origen: ${origin}`);
      return callback(new Error('Origen no permitido por CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // ngrok-skip-browser-warning: la app móvil la manda en TODAS sus peticiones
    // (ver mobile/lib/api.ts) para que, cuando corre detrás de un túnel ngrok,
    // no le devuelvan la página HTML de advertencia en vez del JSON. Sin
    // agregarla aquí, cualquier cliente basado en navegador (Expo web, el
    // futuro panel) fallaría el preflight de CORS aunque no haya ningún túnel
    // de por medio.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'ngrok-skip-browser-warning'],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'Content-Disposition'],
    maxAge: 86_400,
  });

  /**
   * ── Validación ───────────────────────────────────────────────────────────
   * Las tres opciones que importan:
   *   · whitelist          — descarta las propiedades que no están en el DTO.
   *   · forbidNonWhitelisted — y además rechaza la petición si venían de más.
   *     Esto evita el "mass assignment": que alguien mande {"role":"ADMIN"} en
   *     el registro y acabe en la base porque el modelo lo aceptaba.
   *   · transform          — convierte los tipos según el DTO (los query
   *     params llegan siempre como texto).
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // En producción no se devuelve el valor recibido en el error: podría
      // contener la contraseña que el usuario acaba de escribir.
      disableErrorMessages: false,
      validationError: { target: false, value: !isProduction },
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter(isProduction));

  const prefix = config.getOrThrow<string>('API_PREFIX');
  app.setGlobalPrefix(prefix, {
    // /health queda fuera del prefijo para que las sondas de Kubernetes y los
    // monitores externos apunten siempre a la misma ruta aunque cambie la
    // versión de la API.
    exclude: ['health', 'health/ready', 'health/live'],
  });

  // ── Documentación ────────────────────────────────────────────────────────
  // Swagger solo fuera de producción: expone la superficie completa de la API,
  // que es un mapa gratis para quien quiera buscarle las vueltas.
  if (!isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('AM Cuenta · API')
        .setDescription(
          'API de la aplicación AM Cuenta. Los clientes consultan su saldo; ' +
            'los administradores lo modifican desde el panel.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Documentación disponible en /${prefix}/docs`);
  }

  /**
   * ── Apagado limpio ───────────────────────────────────────────────────────
   * Sin esto, al desplegar una versión nueva el contenedor recibe SIGTERM y
   * muere de golpe: las peticiones en vuelo se cortan y los eventos que el
   * worker estaba procesando quedan marcados como PROCESSING para siempre.
   *
   * Con los hooks activos, Nest deja de aceptar conexiones nuevas, espera a que
   * terminen las que hay, corre onModuleDestroy (donde el worker acaba su ciclo
   * y Prisma cierra el pool) y recién ahí sale.
   */
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');

  logger.log(`AM Cuenta API escuchando en el puerto ${port} · entorno ${config.get('NODE_ENV')}`);
}

bootstrap().catch((error) => {
  // Los fallos de arranque (configuración inválida, base inalcanzable) no
  // tienen logger aún: se imprimen en crudo y se sale con código distinto de 0
  // para que el orquestador sepa que el despliegue falló.
  console.error('\nNo se pudo arrancar la API:\n', error?.message ?? error, '\n');
  process.exit(1);
});
