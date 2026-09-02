import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarAreaSchema,
  crearAreaSchema,
  idAreaSchema,
} from './area.schema.js';
import { areaService } from './area.service.js';

/**
 * Controlador HTTP del módulo de áreas.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const areaController = {
  /**
   * GET /api/v1/areas
   */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registros = await areaService.listar();
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/areas/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAreaSchema.parse(req.params);
      const area = await areaService.obtenerPorId(id);
      responderExito(res, area, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/areas
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearAreaSchema.parse(req.body);
      const registro = await areaService.crear(entrada);
      responderExito(res, registro, 201, 'Área creada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/areas/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAreaSchema.parse(req.params);
      const entrada = actualizarAreaSchema.parse(req.body);
      const registro = await areaService.actualizar(id, entrada);
      responderExito(res, registro, 200, 'Área actualizada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/areas/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idAreaSchema.parse(req.params);
      await areaService.eliminar(id);
      responderExito(res, null, 200, 'Área eliminada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
