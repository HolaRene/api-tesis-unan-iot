import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarThresholdSchema,
  crearThresholdSchema,
  idThresholdSchema,
} from './threshold.schema.js';
import { thresholdService } from './threshold.service.js';

/**
 * Controlador HTTP del módulo de umbrales.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const thresholdController = {
  /**
   * GET /api/v1/thresholds
   */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registros = await thresholdService.listar();
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/thresholds/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idThresholdSchema.parse(req.params);
      const registro = await thresholdService.obtenerPorId(id);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/thresholds
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearThresholdSchema.parse(req.body);
      const registro = await thresholdService.crear(entrada);
      responderExito(res, registro, 201, 'Umbral creado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/thresholds/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idThresholdSchema.parse(req.params);
      const entrada = actualizarThresholdSchema.parse(req.body);
      const registro = await thresholdService.actualizar(id, entrada);
      responderExito(res, registro, 200, 'Umbral actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/thresholds/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idThresholdSchema.parse(req.params);
      await thresholdService.eliminar(id);
      responderExito(res, null, 200, 'Umbral eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
