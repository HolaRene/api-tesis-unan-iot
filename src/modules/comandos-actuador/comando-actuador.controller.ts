import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import {
  crearComandoWebSchema,
  idActuadorParamSchema,
  listarComandosSchema,
} from './comando-actuador.schema.js';
import { comandoActuadorService } from './comando-actuador.service.js';

/**
 * Controlador del módulo de comandos de actuadores (rutas web con JWT).
 */
export const comandoActuadorController = {
  /**
   * POST /api/v1/actuadores/:id/comandos
   * Crea un comando originado por un usuario (registra `usuario_id`).
   */
  async crearEnActuador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idActuadorParamSchema.parse(req.params);
      const entrada = crearComandoWebSchema.parse(req.body);
      const usuarioId = req.usuario?.id;
      if (!usuarioId) {
        next(ApiError.unauthorized('Usuario no autenticado'));
        return;
      }

      const comando = await comandoActuadorService.crearDesdeWeb({
        actuador_id: id,
        usuario_id: usuarioId,
        comando: entrada.comando,
        valor: entrada.valor as Record<string, unknown> | undefined,
        metadatos: entrada.metadatos,
      });

      responderExito(res, comando, 201, 'Comando registrado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/actuadores/:id/comandos
   * Lista los comandos de un actuador (lectura para cualquier autenticado).
   */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idActuadorParamSchema.parse(req.params);
      const q = listarComandosSchema.parse(req.query ?? {});
      const comandos = await comandoActuadorService.listarPorActuador(id, q.limite ?? 50);
      responderExito(res, comandos, 200);
    } catch (error) {
      next(error);
    }
  },
};
