import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarSensorSchema,
  crearSensorSchema,
  idSensorSchema,
} from './sensor.schema.js';
import { sensorService } from './sensor.service.js';
import { measurementService } from '../measurements/measurement.service.js';

/**
 * Controlador HTTP del módulo de sensores.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const sensorController = {
  /**
   * GET /api/v1/sensors
   * Filtros opcionales en query: area_id, dispositivo_id, tipo_variable_id,
   * activo ('true'/'false'), buscar (nombre/código).
   */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as Record<string, string | undefined>;
      const registros = await sensorService.listar({
        area_id: q.area_id,
        dispositivo_id: q.dispositivo_id,
        tipo_variable_id: q.tipo_variable_id,
        activo: q.activo === 'true' ? true : q.activo === 'false' ? false : undefined,
        buscar: q.buscar,
      });
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/sensors/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idSensorSchema.parse(req.params);
      const registro = await sensorService.obtenerPorId(id);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/sensors
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearSensorSchema.parse(req.body);
      const registro = await sensorService.crear(entrada);
      responderExito(res, registro, 201, 'Sensor creado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/sensors/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idSensorSchema.parse(req.params);
      const entrada = actualizarSensorSchema.parse(req.body);
      const registro = await sensorService.actualizar(id, entrada);
      responderExito(res, registro, 200, 'Sensor actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/sensors/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idSensorSchema.parse(req.params);
      await sensorService.eliminar(id);
      responderExito(res, null, 200, 'Sensor eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/sensors/:id/mediciones
   * Historial del sensor (filtros opcionales desde/hasta/limite).
   */
  async historialMediciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idSensorSchema.parse(req.params);
      const q = req.query as Record<string, string | undefined>;
      await sensorService.obtenerPorId(id); // 404 si no existe
      const mediciones = await measurementService.listarHistorialSensor(id, {
        desde: q.desde,
        hasta: q.hasta,
        limite: q.limite ? Number(q.limite) : undefined,
      });
      responderExito(res, { sensor_id: id, mediciones }, 200);
    } catch (error) {
      next(error);
    }
  },
};
