import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  idUsuarioSchema,
  loginSchema,
} from './user.schema.js';
import { usuarioService } from './user.service.js';

/**
 * Controlador HTTP del módulo de usuarios.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 */
export const usuarioController = {
  /**
   * POST /api/v1/users/registro
   */
  async registrar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearUsuarioSchema.parse(req.body);
      const usuario = await usuarioService.registrar(entrada);
      responderExito(res, usuario, 201, 'Usuario registrado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/users/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = loginSchema.parse(req.body);
      const resultado = await usuarioService.login(entrada);
      responderExito(res, resultado, 200, 'Sesión iniciada correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/perfil
   */
  async perfil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idUsuario = req.usuario?.id;
      if (idUsuario === undefined) {
        res.status(401).json({ exito: false, mensaje: 'No autenticado' });
        return;
      }
      const usuario = await usuarioService.obtenerPorId(idUsuario);
      responderExito(res, usuario, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users
   */
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarios = await usuarioService.listar();
      responderExito(res, usuarios, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/:id
   */
  async obtenerPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idUsuarioSchema.parse(req.params);
      const usuario = await usuarioService.obtenerPorId(id);
      responderExito(res, usuario, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/users/:id
   */
  async actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idUsuarioSchema.parse(req.params);
      const entrada = actualizarUsuarioSchema.parse(req.body);
      const usuario = await usuarioService.actualizar(id, entrada);
      responderExito(res, usuario, 200, 'Usuario actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/users/:id
   */
  async eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = idUsuarioSchema.parse(req.params);
      await usuarioService.eliminar(id);
      responderExito(res, null, 200, 'Usuario eliminado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
