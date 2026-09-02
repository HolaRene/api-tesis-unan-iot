import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarAlertSchema,
  crearAlertSchema,
  idAlertSchema,
} from './alert.schema.js';
import { alertService } from './alert.service.js';

/**
 * Controlador HTTP del módulo de alertas.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const alertController = {
  /**
   * GET /api/v1/alerts
   */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registros = await alertService.listar();
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/alerts/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAlertSchema.parse(req.params);
      const registro = await alertService.obtenerPorId(id);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/alerts
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearAlertSchema.parse(req.body);
      const registro = await alertService.crear(entrada);
      responderExito(res, registro, 201, 'Alerta creada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/alerts/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAlertSchema.parse(req.params);
      const entrada = actualizarAlertSchema.parse(req.body);
      const registro = await alertService.actualizar(id, entrada);
      responderExito(res, registro, 200, 'Alerta actualizada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/alerts/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAlertSchema.parse(req.params);
      await alertService.eliminar(id);
      responderExito(res, null, 200, 'Alerta eliminada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
