import { Router } from 'express';
import { reglaController } from './regla-alerta.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';

const router = Router();
router.use(middlewareAuth);

router.get('/', reglaController.listar);
router.get('/:id', reglaController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), reglaController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), reglaController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), reglaController.eliminar);

export default router;
