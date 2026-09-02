import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarVariableTypeSchema,
  crearVariableTypeSchema,
  idVariableTypeSchema,
} from './variable-type.schema.js';
import { variableTypeService } from './variable-type.service.js';

/**
 * Controlador HTTP del módulo de tipos de variable.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const variableTypeController = {
  /**
   * GET /api/v1/variable-types
   */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registros = await variableTypeService.listar();
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/variable-types/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idVariableTypeSchema.parse(req.params);
      const registro = await variableTypeService.obtenerPorId(id);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/variable-types
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearVariableTypeSchema.parse(req.body);
      const registro = await variableTypeService.crear(entrada);
      responderExito(res, registro, 201, 'Tipo de variable creado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/variable-types/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idVariableTypeSchema.parse(req.params);
      const entrada = actualizarVariableTypeSchema.parse(req.body);
      const registro = await variableTypeService.actualizar(id, entrada);
      responderExito(res, registro, 200, 'Tipo de variable actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/variable-types/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idVariableTypeSchema.parse(req.params);
      await variableTypeService.eliminar(id);
      responderExito(res, null, 200, 'Tipo de variable eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
