/**
 * Aplica las migraciones SQL de `src/database/migrations` a la base de datos.
 *
 * ────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE SCRIPT (y no solo el .sh)
 * ────────────────────────────────────────────────────────────────────
 * El proyecto se usa en Windows y en Linux. El script original
 * (`scripts/migrate.sh`) invocaba `bash` y el binario `psql`, que en Windows
 * no están en el PATH por defecto:
 *
 *     > pnpm migrate
 *     "bash" no se reconoce como un comando interno o externo,
 *     programa o archivo por lotes ejecutable.
 *
 * Este script hace lo mismo usando el driver `pg` (ya presente en el
 * proyecto), así que funciona igual en Windows, Linux y macOS sin instalar
 * nada extra.
 *
 * ────────────────────────────────────────────────────────────────────
 * USO
 * ────────────────────────────────────────────────────────────────────
 *     pnpm migrate
 *
 * ────────────────────────────────────────────────────────────────────
 * ⚠️ CUIDADO: `0009_canales.sql` CONTIENE UN TRUNCATE
 * ────────────────────────────────────────────────────────────────────
 * Las migraciones se aplican TODAS en cada ejecución, sin llevar registro de
 * cuáles ya se aplicaron. `0009_canales.sql` vacía 11 tablas (mediciones,
 * sensores, dispositivos, camaras, alertas, areas…), conservando `usuarios`
 * y `tipos_variable`.
 *
 *   - Base de datos RECIÉN CREADA → sin problema.
 *   - Base de datos CON DATOS     → se pierden esos datos.
 *
 * Para ese segundo caso, aplica a mano solo el archivo nuevo (ver README).
 */
import { config as cargarDotenv } from 'dotenv';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

/** Carpeta con los archivos .sql, relativa a la raíz de la API. */
const DIRECTORIO_MIGRACIONES = path.resolve(
  process.cwd(),
  'src/database/migrations'
);

/**
 * Carga las variables de entorno igual que lo hace la API:
 * primero `.env.<NODE_ENV>` y después `.env`.
 *
 * Se replica aquí porque este script también se puede ejecutar de forma
 * suelta (`tsx scripts/migrate.ts`), y en ese caso no ha pasado por
 * `src/config/env.ts`.
 */
function cargarVariablesDeEntorno(): void {
  const entorno = process.env.NODE_ENV ?? 'development';

  for (const archivo of [`.env.${entorno}`, '.env']) {
    const ruta = path.resolve(process.cwd(), archivo);
    if (existsSync(ruta)) {
      cargarDotenv({ path: ruta, override: false });
    }
  }
}

/** Devuelve los archivos .sql ordenados por nombre (0001, 0002…). */
function obtenerMigraciones(): string[] {
  if (!existsSync(DIRECTORIO_MIGRACIONES)) {
    throw new Error(
      `No existe el directorio de migraciones: ${DIRECTORIO_MIGRACIONES}`
    );
  }

  return readdirSync(DIRECTORIO_MIGRACIONES)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function principal(): Promise<void> {
  cargarVariablesDeEntorno();

  const cadenaConexion = process.env.DATABASE_URL;

  if (!cadenaConexion) {
    console.error(
      'Error: no se encontró DATABASE_URL. Configúrelo en .env o .env.development'
    );
    process.exit(1);
  }

  const migraciones = obtenerMigraciones();

  if (migraciones.length === 0) {
    console.error(`Error: no hay archivos .sql en ${DIRECTORIO_MIGRACIONES}`);
    process.exit(1);
  }

  console.log(`Aplicando migraciones desde ${DIRECTORIO_MIGRACIONES} ...`);

  const cliente = new Client({ connectionString: cadenaConexion });

  try {
    await cliente.connect();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`Error: no se pudo conectar a la base de datos.\n  ${mensaje}`);
    console.error(
      '\n  Revise DATABASE_URL y que PostgreSQL esté en ejecución.'
    );
    process.exit(1);
  }

  let aplicadas = 0;

  try {
    for (const archivo of migraciones) {
      const ruta = path.join(DIRECTORIO_MIGRACIONES, archivo);
      const sql = readFileSync(ruta, 'utf8');

      console.log(`-> Aplicando: ${archivo}`);

      // Cada archivo se ejecuta en su propia transacción: si una migración
      // falla, esa migración se revierte y el proceso se detiene, en lugar de
      // dejar el esquema a medias.
      try {
        await cliente.query('BEGIN');
        await cliente.query(sql);
        await cliente.query('COMMIT');
        aplicadas++;
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {
          /* Si el ROLLBACK falla, el error original es el relevante. */
        });

        const detalle = error instanceof Error ? error.message : String(error);
        console.error(`\nError al aplicar ${archivo}:\n  ${detalle}`);
        console.error(
          '\n  Las migraciones anteriores sí se aplicaron. Corrija el archivo y' +
            ' vuelva a ejecutar (las migraciones ya aplicadas se re-ejecutan).'
        );
        process.exit(1);
      }
    }
  } finally {
    await cliente.end();
  }

  console.log(
    `\nMigraciones aplicadas correctamente (${aplicadas} archivos).`
  );
}

// Se usa `.catch` en lugar de `await` en la raíz para dejar claro que
// cualquier error no controlado termina el proceso con código 1.
principal().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`Error inesperado: ${mensaje}`);
  process.exit(1);
});
