import { Router } from 'express';
import { areaController } from './area.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de áreas, montadas bajo /api/v1/areas.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', areaController.listar);
router.get('/:id', areaController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), areaController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), areaController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), areaController.eliminar);

export default router;
