import type { NextFunction, Request, Response } from 'express';
import { query } from '../../database/pool.js';
import { responderExito } from '../../utils/api-response.js';
import { env } from '../../config/env.js';

/**
 * Verifica la accesibilidad de la base de datos PostgreSQL.
 * Devuelve la versión del servidor si la conexión es exitosa.
 */
async function verificarBaseDeDatos(): Promise<string> {
  const resultado = await query<{ version: string }>('SELECT version()');
  return resultado.rows[0].version;
}

/**
 * Controlador del endpoint de salud de la API.
 */
export const healthController = {
  /**
   * GET /api/v1/health
   *
   * Comprueba que la API responde y que PostgreSQL es accesible.
   * Si la base de datos falla, responde 503.
   */
  async verificar(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const versionPostgres = await verificarBaseDeDatos();
      responderExito(
        res,
        {
          estado: 'ok',
          servicio: 'api-monitoreo-iot',
          entorno: env.NODE_ENV,
          baseDeDatos: 'disponible',
          versionPostgres,
          hora: new Date().toISOString(),
        },
        200,
        'La API y la base de datos están operativas'
      );
    } catch (error) {
      // Si PostgreSQL no responde, se responde 503 Service Unavailable
      // con la información de estado, sin propagar el error real.
      res.status(503).json({
        exito: false,
        mensaje: 'La API está en línea pero la base de datos no está disponible',
        detalles: {
          estado: 'error',
          baseDeDatos: 'no_disponible',
          hora: new Date().toISOString(),
        },
      });
      // Se registra el error en consola para diagnóstico, pero no se
      // reenvía al middleware de errores para evitar duplicar la respuesta.
      console.error('[health] Error al consultar la base de datos', error);
    }
  },
};
