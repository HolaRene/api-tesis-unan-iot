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

/**
 * Siembra una cámara IP de ejemplo, SIN conexión real.
 *
 * Sirve para trabajar la interfaz antes de tener la cámara física:
 *   - La IP es de ejemplo y NUNCA se contacta.
 *   - El estado queda `desconectada` a propósito.
 *   - No se guardan credenciales (el modelo no las admite).
 */
async function sembrarCamaraDePrueba(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('No se encontró DATABASE_URL. Configúrelo en el archivo de entorno.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Se asigna al admin más antiguo (mismo criterio que las migraciones).
    const admin = await pool.query<{ id: string }>(
      `SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY creado_en ASC LIMIT 1`
    );

    const resultado = await pool.query<{ id: string }>(
      `INSERT INTO camaras
         (nombre, descripcion, direccion_ip, puerto_rtsp, protocolo,
          ruta_stream, ruta_webrtc, estado, activa, metadatos, propietario_id)
       VALUES
         ($1, $2, $3, $4, 'rtsp', $5, $6, 'desconectada', TRUE, $7::jsonb, $8)
       ON CONFLICT (ruta_webrtc) WHERE ruta_webrtc IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        'Cámara Quirófano 1',
        'Cámara de supervisión visual (ejemplo, sin conexión real).',
        '192.168.1.50',
        554,
        '/stream1',
        '/camara-qui-1',
        JSON.stringify({
          ejemplo: true,
          nota: 'Configuración de ejemplo; no se contacta ninguna IP real.',
        }),
        admin.rows[0]?.id ?? null,
      ]
    );

    if (resultado.rows.length > 0) {
      console.log('[seed] Cámara de prueba creada: Cámara Quirófano 1 (/camara-qui-1)');
    } else {
      console.log('[seed] La cámara de prueba ya existía (/camara-qui-1)');
    }
  } finally {
    await pool.end();
  }
}

sembrarUsuarioAdmin()
  .then(() => sembrarCamaraDePrueba())
  .catch((error) => {
    console.error('[seed] Error al sembrar datos', error);
    process.exit(1);
  });
