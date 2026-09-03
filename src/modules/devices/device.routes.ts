import { Router } from 'express';
import { deviceController } from './device.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de dispositivos, montadas bajo /api/v1/devices.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', deviceController.listar);
router.get('/:id', deviceController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), deviceController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), deviceController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), deviceController.eliminar);

export default router;
