import { Router } from 'express';
import { cameraController } from './camera.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(middlewareAuth);
router.get('/', cameraController.listar);
router.get('/:id', cameraController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), cameraController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), cameraController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), cameraController.eliminar);

export default router;
