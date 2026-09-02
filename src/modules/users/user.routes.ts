import { Router } from 'express';
import { usuarioController } from './user.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de usuarios, montadas bajo /api/v1/users.
 */
const router = Router();

// Autenticación pública
router.post('/registro', usuarioController.registrar);
router.post('/login', usuarioController.login);

// Perfil y CRUD (requieren autenticación)
router.get('/perfil', middlewareAuth, usuarioController.perfil);
router.get('/', middlewareAuth, usuarioController.listar);
router.get('/:id', middlewareAuth, usuarioController.obtenerPorId);
router.patch('/:id', middlewareAuth, usuarioController.actualizar);
router.delete('/:id', middlewareAuth, usuarioController.eliminar);

export default router;
