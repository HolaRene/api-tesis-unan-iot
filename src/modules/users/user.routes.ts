import { Router } from 'express';
import { usuarioController } from './user.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';
import { soloAdmin } from '../../middlewares/permisos.middleware.js';

/**
 * Rutas del módulo de usuarios, montadas bajo /api/v1/users.
 *
 * - registro y login: públicos.
 * - perfil: cualquier usuario autenticado.
 * - crear/actualizar/eliminar usuarios y listarlos: solo admin.
 */
const router = Router();

// Públicas
router.post('/registro', usuarioController.registrar);
router.post('/login', usuarioController.login);

// Perfil propio (cualquier usuario autenticado)
router.get('/perfil', middlewareAuth, usuarioController.perfil);

// Gestión de usuarios: solo admin
router.post('/', middlewareAuth, soloAdmin, usuarioController.crearPorAdmin);
router.get('/', middlewareAuth, soloAdmin, usuarioController.listar);
router.get('/:id', middlewareAuth, soloAdmin, usuarioController.obtenerPorId);
router.patch('/:id', middlewareAuth, soloAdmin, usuarioController.actualizar);
router.delete('/:id', middlewareAuth, soloAdmin, usuarioController.eliminar);

export default router;
