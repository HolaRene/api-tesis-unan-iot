import { Router } from 'express';
import { sensorController } from './sensor.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de sensores, montadas bajo /api/v1/sensors.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', sensorController.listar);
router.get('/:id', sensorController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), sensorController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), sensorController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), sensorController.eliminar);

export default router;
