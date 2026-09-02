import { Router } from 'express';
import { alertController } from './alert.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de alertas, montadas bajo /api/v1/alerts.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', alertController.listar);
router.get('/:id', alertController.obtenerPorId);
router.post('/', alertController.crear);
router.patch('/:id', alertController.actualizar);
router.delete('/:id', alertController.eliminar);

export default router;
