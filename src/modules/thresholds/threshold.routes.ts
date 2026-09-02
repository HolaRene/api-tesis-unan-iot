import { Router } from 'express';
import { thresholdController } from './threshold.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de umbrales, montadas bajo /api/v1/thresholds.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', thresholdController.listar);
router.get('/:id', thresholdController.obtenerPorId);
router.post('/', thresholdController.crear);
router.patch('/:id', thresholdController.actualizar);
router.delete('/:id', thresholdController.eliminar);

export default router;
