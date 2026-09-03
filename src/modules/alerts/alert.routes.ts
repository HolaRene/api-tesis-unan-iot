import { Router } from 'express';
import { alertController } from './alert.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de alertas, montadas bajo /api/v1/alerts.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', alertController.listar);
router.get('/:id', alertController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), alertController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), alertController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), alertController.eliminar);

export default router;
