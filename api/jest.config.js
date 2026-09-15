/**
 * Dos proyectos de test en una sola configuración: unitarios (rápidos, sin
 * base de datos, corren en cada guardado) y e2e (contra Postgres real, corren
 * en CI y antes de desplegar). Separarlos permite `npm run test:unit` en
 * modo watch mientras se programa, sin esperar a que arranque un contenedor.
 *
 * ── Por qué `isolatedModules: true` en ts-jest ──────────────────────────────
 * Sin esto, ts-jest carga el PROGRAMA de TypeScript completo (con todos los
 * `node_modules` de tipos incluidos: Prisma, googleapis, exceljs...) y
 * revisa los tipos de cada archivo contra ese programa entero, en cada uno de
 * los workers en paralelo. Con varios workers a la vez eso multiplica la
 * memoria varias veces y, en una máquina con pocos recursos libres, puede
 * agotar el heap y colgar el sistema entero (es justo lo que pasó en esta
 * sesión: 5 workers en paralelo tardaron 500+ segundos y terminaron en
 * "JavaScript heap out of memory").
 *
 * `isolatedModules` hace que ts-jest transpile cada archivo de forma aislada
 * (como hace Babel), sin construir el programa completo. La verificación de
 * tipos de verdad ya la hace `npm run build`/`tsc --noEmit` por separado — los
 * tests no necesitan repetirla, solo necesitan que el código se ejecute.
 */
module.exports = {
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      collectCoverageFrom: [
        'src/**/*.(t|j)s',
        '!src/**/*.spec.ts',
        '!src/**/*.module.ts',
        '!src/main.ts',
      ],
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
      },
      moduleFileExtensions: ['js', 'json', 'ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],
    },
  ],
  coverageDirectory: './coverage',
  // El dominio (value objects, casos de uso) es donde más importa el
  // cubrimiento: es la lógica de negocio pura, sin infraestructura de por
  // medio. No se exige un número global arbitrario para toda la app.
  coverageThreshold: {
    './src/shared/domain/**/*.ts': { statements: 90, branches: 85 },
  },
};
