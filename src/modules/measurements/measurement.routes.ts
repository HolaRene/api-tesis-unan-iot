import { Router } from 'express';
import { measurementController } from './measurement.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de mediciones, montadas bajo /api/v1/measurements.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

// IMPORTANTE: `/series` va ANTES de `/:id`, o Express interpretaría
// "series" como un id de medición.
router.get('/series', measurementController.series);

router.get('/', measurementController.listar);
router.get('/:id', measurementController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), measurementController.crear);
router.delete('/:id', requiereRol('usuario', 'admin'), measurementController.eliminar);

export default router;
