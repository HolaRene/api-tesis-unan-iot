import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { actualizarCameraSchema, crearCameraSchema, idCameraSchema } from './camera.schema.js';
import { cameraService } from './camera.service.js';

export const cameraController = {
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const r = await cameraService.listar(); responderExito(res, r, 200); } catch (e) { next(e); }
  },
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idCameraSchema.parse(req.params); const r = await cameraService.obtenerPorId(id); responderExito(res, r, 200); } catch (e) { next(e); }
  },
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const e = crearCameraSchema.parse(req.body); const r = await cameraService.crear(e); responderExito(res, r, 201, 'Cámara creada correctamente'); } catch (e) { next(e); }
  },
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idCameraSchema.parse(req.params); const e = actualizarCameraSchema.parse(req.body); const r = await cameraService.actualizar(id, e); responderExito(res, r, 200, 'Cámara actualizada correctamente'); } catch (e) { next(e); }
  },
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idCameraSchema.parse(req.params); await cameraService.eliminar(id); responderExito(res, null, 200, 'Cámara eliminada correctamente'); } catch (e) { next(e); }
  },
};
