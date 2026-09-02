/**
 * Script de sembrado (seed) de datos iniciales.
 *
 * Crea un usuario administrador inicial si no existe. El hash de la
 * contraseña se genera en tiempo de ejecución para no depender de
 * hashes precalculados.
 *
 * Uso: pnpm seed
 */
import 'dotenv/config';
import { config as cargarDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

// Carga el archivo de entorno según el modo (similar a config/env.ts).
function cargarVariables(): void {
  const entorno = process.env.NODE_ENV ?? 'development';
  const rutaEspecifica = path.resolve(process.cwd(), `.env.${entorno}`);
  const rutaBase = path.resolve(process.cwd(), '.env');
  if (existsSync(rutaEspecifica)) cargarDotenv({ path: rutaEspecifica });
  else if (existsSync(rutaBase)) cargarDotenv({ path: rutaBase });
}
cargarVariables();

// Datos del usuario administrador inicial (ajustar en producción).
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@monitoreo.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrador';

async function sembrarUsuarioAdmin(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('No se encontró DATABASE_URL. Configúrelo en el archivo de entorno.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, hash_contra, rol)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, nombre, email, rol`,
      [ADMIN_NAME, ADMIN_EMAIL, hash]
    );

    if (resultado.rows.length > 0) {
      console.log('[seed] Usuario administrador creado:', ADMIN_EMAIL);
    } else {
      console.log('[seed] El usuario administrador ya existía:', ADMIN_EMAIL);
    }
  } finally {
    await pool.end();
  }
}

sembrarUsuarioAdmin().catch((error) => {
  console.error('[seed] Error al sembrar datos', error);
  process.exit(1);
});
