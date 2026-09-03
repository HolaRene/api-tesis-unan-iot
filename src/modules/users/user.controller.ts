import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import {
  actualizarMiPerfilSchema,
  actualizarUsuarioSchema,
  crearUsuarioAdminSchema,
  crearUsuarioSchema,
  idUsuarioSchema,
  loginSchema,
} from './user.schema.js';
import { usuarioService } from './user.service.js';

/**
 * Controlador HTTP del módulo de usuarios.
 * Solo gestiona request/response; la lógica de negocio está en el service.
 * Las rutas de gestión de usuarios quedan restringidas a admin a nivel de
 * rutas (ver user.routes.ts).
 */
export const usuarioController = {
  /**
   * POST /api/v1/users/registro
   * Registro público: SIEMPRE crea el usuario con rol `viewer`.
   */
  async registrar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearUsuarioSchema.parse(req.body);
      const usuario = await usuarioService.registrar(entrada);
      responderExito(res, usuario, 201, 'Usuario registrado correctamente (rol viewer)');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/users
   * Solo admin: crea un usuario y asigna el rol elegido (invitación).
   */
  async crearPorAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = crearUsuarioAdminSchema.parse(req.body);
      const usuario = await usuarioService.crearPorAdmin(entrada);
      responderExito(res, usuario, 201, 'Usuario creado correctamente');
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
   * El propio usuario autenticado (cualquier rol) consulta su perfil.
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
   * PATCH /api/v1/users/perfil
   * Cualquier usuario autenticado actualiza su propio perfil (nombre, email
   * y/o contraseña). El id se toma de la sesión, no de la URL.
   */
  async actualizarPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idUsuario = req.usuario?.id;
      if (idUsuario === undefined) {
        res.status(401).json({ exito: false, mensaje: 'No autenticado' });
        return;
      }
      const entrada = actualizarMiPerfilSchema.parse(req.body);
      const usuario = await usuarioService.actualizarMiPerfil(idUsuario, entrada);
      responderExito(res, usuario, 200, 'Perfil actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users - solo admin
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
   * GET /api/v1/users/:id - solo admin
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
   * PATCH /api/v1/users/:id - solo admin
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
   * DELETE /api/v1/users/:id - solo admin
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
