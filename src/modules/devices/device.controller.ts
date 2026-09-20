import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarDeviceSchema,
  crearDeviceSchema,
  idDeviceSchema,
} from './device.schema.js';
import { deviceService } from './device.service.js';

/**
 * Controlador HTTP del módulo de dispositivos.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const deviceController = {
  /**
   * GET /api/v1/devices
   */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registros = await deviceService.listar(req.usuario);
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/devices/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idDeviceSchema.parse(req.params);
      const dispositivo = await deviceService.obtenerPorId(id, req.usuario);
      responderExito(res, dispositivo, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/devices
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearDeviceSchema.parse(req.body);
      const registro = await deviceService.crear(entrada, req.usuario);
      responderExito(res, registro, 201, 'Dispositivo creado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/devices/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idDeviceSchema.parse(req.params);
      const entrada = actualizarDeviceSchema.parse(req.body);
      const registro = await deviceService.actualizar(id, entrada, req.usuario);
      responderExito(res, registro, 200, 'Dispositivo actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/devices/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idDeviceSchema.parse(req.params);
      await deviceService.eliminar(id, req.usuario);
      responderExito(res, null, 200, 'Dispositivo eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
