import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarActuadorSchema,
  crearActuadorSchema,
  idActuadorSchema,
} from './actuador.schema.js';
import { actuadorService } from './actuador.service.js';

/**
 * Controlador HTTP del módulo de actuadores.
 */
export const actuadorController = {
  /** GET /api/v1/actuadores */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actuadores = await actuadorService.listar();
      responderExito(res, actuadores, 200);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/actuadores/:id */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idActuadorSchema.parse(req.params);
      const actuador = await actuadorService.obtenerPorId(id);
      responderExito(res, actuador, 200);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/actuadores */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearActuadorSchema.parse(req.body);
      const actuador = await actuadorService.crear(entrada);
      responderExito(res, actuador, 201, 'Actuador creado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /** PATCH /api/v1/actuadores/:id */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idActuadorSchema.parse(req.params);
      const entrada = actualizarActuadorSchema.parse(req.body);
      const actuador = await actuadorService.actualizar(id, entrada);
      responderExito(res, actuador, 200, 'Actuador actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/v1/actuadores/:id */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idActuadorSchema.parse(req.params);
      await actuadorService.eliminar(id);
      responderExito(res, null, 200, 'Actuador eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
