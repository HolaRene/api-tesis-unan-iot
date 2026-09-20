import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarCamaraSchema,
  actualizarEstadoCamaraSchema,
  crearCamaraSchema,
  idCamaraSchema,
  listarCamarasSchema,
} from './camera.schema.js';
import { camaraService } from './camera.service.js';

/**
 * Controlador HTTP del módulo de cámaras IP.
 * Solo gestiona request/response; la lógica está en el service.
 */
export const camaraController = {
  /**
   * GET /api/v1/camaras
   * Filtros: area_id, dispositivo_id, estado, activa, buscar.
   */
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filtro = listarCamarasSchema.parse(req.query);
      const registros = await camaraService.listar(filtro, req.usuario);
      responderExito(res, registros, 200);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/camaras/:id */
  async obtenerPorId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = idCamaraSchema.parse(req.params);
      const registro = await camaraService.obtenerPorId(id, req.usuario);
      responderExito(res, registro, 200);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/camaras */
  async crear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearCamaraSchema.parse(req.body);
      const registro = await camaraService.crear(entrada, req.usuario);
      responderExito(res, registro, 201, 'Cámara creada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /** PATCH /api/v1/camaras/:id */
  async actualizar(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = idCamaraSchema.parse(req.params);
      const entrada = actualizarCamaraSchema.parse(req.body);
      const registro = await camaraService.actualizar(id, entrada, req.usuario);
      responderExito(res, registro, 200, 'Cámara actualizada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/camaras/:id/estado
   * Endpoint para pruebas y para la futura integración con MediaMTX.
   */
  async actualizarEstado(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = idCamaraSchema.parse(req.params);
      const { estado } = actualizarEstadoCamaraSchema.parse(req.body);
      const registro = await camaraService.actualizarEstado(
        id,
        estado,
        req.usuario
      );
      responderExito(res, registro, 200, 'Estado de la cámara actualizado');
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/v1/camaras/:id */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idCamaraSchema.parse(req.params);
      await camaraService.eliminar(id, req.usuario);
      responderExito(res, null, 200, 'Cámara eliminada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
