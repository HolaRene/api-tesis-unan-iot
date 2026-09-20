import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  crearMeasurementSchema,
  idMedicionSchema,
  listarMedicionesSchema,
} from './measurement.schema.js';
import { measurementService } from './measurement.service.js';

/**
 * Controlador HTTP del módulo de mediciones.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const measurementController = {
  /**
   * GET /api/v1/measurements — historial global con filtros opcionales.
   */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filtro = listarMedicionesSchema.parse(req.query);
      const registros = await measurementService.listar(
        {
          sensor_id: filtro.sensor_id,
          canal_id: filtro.canal_id,
          dispositivo_id: filtro.dispositivo_id,
          area_id: filtro.area_id,
          tipo_variable_id: filtro.tipo_variable_id,
          desde: filtro.desde,
          hasta: filtro.hasta,
          limite: filtro.limite,
          orden_ascendente: filtro.orden === 'asc',
        },
        req.usuario
      );
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/measurements/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idMedicionSchema.parse(req.params);
      const registro = await measurementService.obtenerPorId(id, req.usuario);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/measurements
   * Endpoint de ingesta: recibe mediciones vía HTTP/REST (Node-RED, etc).
   */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearMeasurementSchema.parse(req.body);
      const registro = await measurementService.crear(entrada);
      responderExito(res, registro, 201, 'Medición registrada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/measurements/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idMedicionSchema.parse(req.params);
      await measurementService.eliminar(id);
      responderExito(res, null, 200, 'Medición eliminada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
