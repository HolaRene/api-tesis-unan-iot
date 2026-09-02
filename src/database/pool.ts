import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

/**
 * Pool reutilizable de conexiones a PostgreSQL.
 *
 * Centraliza la configuración de la conexión a la base de datos a partir
 * de las variables de entorno validadas en src/config/env.ts. Se exporta
 * como instancia única para que todos los repositorios lo compartan.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
});

/**
 * Consulta simplificada sobre el pool. Mantiene a los repositorios
 * agnósticos de los detalles de gestión de conexiones de `pg`.
 */
export const query = pool.query.bind(pool);

/**
 * Cierra el pool de conexiones. Se utiliza durante el apagado controlado
 * del servidor para liberar recursos.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
