import { config as cargarDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Carga el archivo .env adecuado según el entorno.
 *
 * - Si existe `.env` se utiliza directamente.
 * - Si existe `.env.<NODE_ENV>` (por ejemplo `.env.development`) se
 *   prefiere ese archivo para ese entorno.
 *
 * Este mecanismo se ejecuta antes de validar el resto de variables.
 */
function cargarVariablesDeEntorno(): void {
  const entorno = process.env.NODE_ENV ?? 'development';
  const rutaEspecifica = path.resolve(process.cwd(), `.env.${entorno}`);
  const rutaBase = path.resolve(process.cwd(), '.env');

  if (existsSync(rutaEspecifica)) {
    cargarDotenv({ path: rutaEspecifica });
  } else if (existsSync(rutaBase)) {
    cargarDotenv({ path: rutaBase });
  }
}

cargarVariablesDeEntorno();

/**
 * Esquema Zod que centraliza y valida todas las variables de entorno
 * utilizadas por la API. Al cargar el módulo, las variables son
 * validadas y tipadas de forma centralizada.
 *
 * Si falta alguna variable requerida o su valor no es válido, la
 * aplicación no arrancará, lo que evita errores silenciosos en runtime.
 */
const envSchema = z.object({
  // Entorno de ejecución: development | production | test
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Puerto en el que escuchará el servidor Express
  PORT: z.coerce.number().int().positive().default(3000),

  // Orígenes CORS permitidos, separados por coma
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((valores) =>
      valores
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    ),

  // Cadena de conexión a PostgreSQL
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  // Número máximo de conexiones en el pool de PostgreSQL
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Secreto para firmar tokens JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET es obligatorio'),

  // Tiempo de expiración del token de acceso (ej: "15m", "7d")
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Secreto para firmar cookies
  COOKIE_SECRET: z.string().min(1, 'COOKIE_SECRET es obligatorio'),

  // Límite de solicitudes por ventana de tiempo (rate limit)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

/**
 * Tipo inferido a partir del esquema Zod. Representa la forma final
 * tipada de las variables de entorno ya procesadas.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Objeto de configuración validado y tipado.
 * Se exporta como constante para su importación en toda la aplicación.
 */
export const env: Env = envSchema.parse(process.env);
