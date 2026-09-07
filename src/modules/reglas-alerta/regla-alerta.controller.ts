import type { Request, Response, NextFunction } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarReglaSchema,
  crearReglaSchema,
  idReglaSchema,
} from './regla-alerta.schema.js';
import { reglaService } from './regla-alerta.service.js';

export const reglaController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as Record<string, string | undefined>;
      const filas = await reglaService.listar({
        canal_id: q.canal_id,
        dispositivo_id: q.dispositivo_id,
        activa: q.activa === 'true' ? true : undefined,
      });
      responderExito(res, filas, 200);
    } catch (e) { next(e); }
  },

  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idReglaSchema.parse(req.params);
      const fila = await reglaService.obtenerPorId(id);
      responderExito(res, fila, 200);
    } catch (e) { next(e); }
  },

  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = crearReglaSchema.parse(req.body);
      const fila = await reglaService.crear(data);
      responderExito(res, fila, 201, 'Regla creada correctamente');
    } catch (e) { next(e); }
  },

  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idReglaSchema.parse(req.params);
      const data = actualizarReglaSchema.parse(req.body);
      const fila = await reglaService.actualizar(id, data);
      responderExito(res, fila, 200, 'Regla actualizada correctamente');
    } catch (e) { next(e); }
  },

  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idReglaSchema.parse(req.params);
      await reglaService.eliminar(id);
      responderExito(res, null, 200, 'Regla eliminada correctamente');
    } catch (e) { next(e); }
  },
};
