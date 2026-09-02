import { Router } from 'express';
import { areaController } from './area.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de áreas, montadas bajo /api/v1/areas.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', areaController.listar);
router.get('/:id', areaController.obtenerPorId);
router.post('/', areaController.crear);
router.patch('/:id', areaController.actualizar);
router.delete('/:id', areaController.eliminar);

export default router;
