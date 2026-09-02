import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { actualizarIntegrationSchema, crearIntegrationSchema, idIntegrationSchema } from './integration.schema.js';
import { integrationService } from './integration.service.js';

export const integrationController = {
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const r = await integrationService.listar(); responderExito(res, r, 200); } catch (e) { next(e); }
  },
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idIntegrationSchema.parse(req.params); const r = await integrationService.obtenerPorId(id); responderExito(res, r, 200); } catch (e) { next(e); }
  },
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const e = crearIntegrationSchema.parse(req.body); const r = await integrationService.crear(e); responderExito(res, r, 201, 'Integración creada correctamente'); } catch (e) { next(e); }
  },
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idIntegrationSchema.parse(req.params); const e = actualizarIntegrationSchema.parse(req.body); const r = await integrationService.actualizar(id, e); responderExito(res, r, 200, 'Integración actualizada correctamente'); } catch (e) { next(e); }
  },
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const { id } = idIntegrationSchema.parse(req.params); await integrationService.eliminar(id); responderExito(res, null, 200, 'Integración eliminada correctamente'); } catch (e) { next(e); }
  },
};
