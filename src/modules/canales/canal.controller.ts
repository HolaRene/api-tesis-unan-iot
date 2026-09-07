import type { Request, Response, NextFunction } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarCanalSchema,
  crearCanalSchema,
  idCanalSchema,
} from './canal.schema.js';
import { canalService } from './canal.service.js';

export const canalController = {
  /** GET /canales (filtros query) */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as Record<string, string | undefined>;
      const filas = await canalService.listar({
        sensor_id: q.sensor_id,
        dispositivo_id: q.dispositivo_id,
        area_id: q.area_id,
        tipo_variable_id: q.tipo_variable_id,
        activo: q.activo === 'true' ? true : undefined,
        buscar: q.buscar,
      });
      responderExito(res, filas, 200);
    } catch (e) { next(e); }
  },

  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idCanalSchema.parse(req.params);
      const fila = await canalService.obtenerPorId(id);
      responderExito(res, fila, 200);
    } catch (e) { next(e); }
  },

  async historialMediciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idCanalSchema.parse(req.params);
      const q = req.query as Record<string, string | undefined>;
      const mediciones = await canalService.historialMediciones(id, {
        desde: q.desde, hasta: q.hasta,
        limite: q.limite ? Number(q.limite) : undefined,
      });
      responderExito(res, { canal_id: id, mediciones }, 200);
    } catch (e) { next(e); }
  },

  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = crearCanalSchema.parse(req.body);
      const fila = await canalService.crear(data);
      responderExito(res, fila, 201, 'Canal creado correctamente');
    } catch (e) { next(e); }
  },

  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idCanalSchema.parse(req.params);
      const data = actualizarCanalSchema.parse(req.body);
      const fila = await canalService.actualizar(id, data);
      responderExito(res, fila, 200, 'Canal actualizado correctamente');
    } catch (e) { next(e); }
  },

  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idCanalSchema.parse(req.params);
      await canalService.eliminar(id);
      responderExito(res, null, 200, 'Canal eliminado correctamente');
    } catch (e) { next(e); }
  },
};
