import { Router } from 'express';
import { deviceController } from './device.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de dispositivos, montadas bajo /api/v1/devices.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', deviceController.listar);
router.get('/:id', deviceController.obtenerPorId);
router.post('/', deviceController.crear);
router.patch('/:id', deviceController.actualizar);
router.delete('/:id', deviceController.eliminar);

export default router;
