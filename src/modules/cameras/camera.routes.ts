import { Router } from 'express';
import { cameraController } from './camera.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(middlewareAuth);
router.get('/', cameraController.listar);
router.get('/:id', cameraController.obtenerPorId);
router.post('/', cameraController.crear);
router.patch('/:id', cameraController.actualizar);
router.delete('/:id', cameraController.eliminar);

export default router;
