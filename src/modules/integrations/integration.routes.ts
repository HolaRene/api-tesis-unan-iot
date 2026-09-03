import { Router } from 'express';
import { integrationController } from './integration.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(middlewareAuth);
router.get('/', integrationController.listar);
router.get('/:id', integrationController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), integrationController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), integrationController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), integrationController.eliminar);

export default router;
