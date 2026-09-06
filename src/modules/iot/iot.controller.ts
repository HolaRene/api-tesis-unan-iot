import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import { comandoIntegracionSchema, ingestaMedicionesSchema } from './iot.schema.js';
import { iotService } from './iot.service.js';

/**
 * Controlador del módulo IoT (rutas de integración con API Key).
 * `req.claveApi` ya fue inyectado por `autenticarApiKey`.
 */
export const iotController = {
  /**
   * POST /api/v1/iot/mediciones
   * Requiere permiso mediciones:crear.
   */
  async ingestaMediciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = ingestaMedicionesSchema.parse(req.body);
      if (!req.claveApi) {
        next(ApiError.unauthorized('No autenticado con API Key'));
        return;
      }
      const resultado = await iotService.ingestaMediciones(
        entrada,
        req.claveApi.usuarioId
      );
      responderExito(res, resultado, 201, 'Mediciones procesadas');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/iot/comandos
   * Requiere permiso comandos:enviar.
   */
  async comandoActuador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = comandoIntegracionSchema.parse(req.body);
      if (!req.claveApi) {
        next(ApiError.unauthorized('No autenticado con API Key'));
        return;
      }
      const comando = await iotService.comandoAUnActuador(entrada, {
        claveApiId: req.claveApi.claveApiId,
      });
      responderExito(res, comando, 201, 'Comando registrado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
