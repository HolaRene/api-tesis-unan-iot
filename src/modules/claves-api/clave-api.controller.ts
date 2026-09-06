import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { crearClaveApiSchema, idClaveApiSchema } from './clave-api.schema.js';
import { claveApiService } from './clave-api.service.js';
import type { PermisosClaveApi } from './clave-api.types.js';

/**
 * Controlador HTTP del módulo de API Keys (rutas de usuario/web con JWT).
 * Solo gestiona request/response; la clave completa se devuelve en el momento
 * de crear y NO se guarda en ningún log.
 */
export const claveApiController = {
  /** GET /api/v1/claves-api — lista las claves del propio usuario. */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = obtenerUsuarioId(req);
      const claves = await claveApiService.listarDeUsuario(usuarioId);
      responderExito(res, claves, 200);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/claves-api — crea una clave y devuelve la completa una sola vez. */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = obtenerUsuarioId(req);
      const entrada = crearClaveApiSchema.parse(req.body);
      const creada = await claveApiService.crear({
        usuario_id: usuarioId,
        nombre: entrada.nombre,
        expira_en: entrada.expira_en ?? null,
        permisos: (entrada.permisos ?? {}) as PermisosClaveApi,
      });
      responderExito(res, creada, 201, 'API Key creada. Guárdela, se muestra una sola vez.');
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/v1/claves-api/:id — revoca (desactiva) una clave propia. */
  async revocar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = obtenerUsuarioId(req);
      const { id } = idClaveApiSchema.parse(req.params);
      await claveApiService.revocar(usuarioId, id);
      responderExito(res, null, 200, 'API Key revocada correctamente');
    } catch (error) {
      next(error);
    }
  },
};

/** Obtiene el id del usuario autenticado por JWT de la solicitud. */
function obtenerUsuarioId(req: Request): string {
  const id = req.usuario?.id;
  if (!id) {
    throw new Error('Usuario no autenticado');
  }
  return id;
}
