import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { dashboardService } from './dashboard.service.js';

/**
 * Controlador del dashboard/resumen.
 */
export const dashboardController = {
  /** GET /api/v1/dashboard/resumen */
  async resumen(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resultado = await dashboardService.obtenerResumen();
      responderExito(res, resultado, 200, 'Resumen obtenido correctamente');
    } catch (error) {
      next(error);
    }
  },
};
