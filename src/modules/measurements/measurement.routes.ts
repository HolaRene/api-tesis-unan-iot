import { Router } from 'express';
import { measurementController } from './measurement.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de mediciones, montadas bajo /api/v1/measurements.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', measurementController.listar);
router.get('/:id', measurementController.obtenerPorId);
router.post('/', measurementController.crear);
router.delete('/:id', measurementController.eliminar);

export default router;
