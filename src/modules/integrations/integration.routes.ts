import { Router } from 'express';
import { integrationController } from './integration.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(middlewareAuth);
router.get('/', integrationController.listar);
router.get('/:id', integrationController.obtenerPorId);
router.post('/', integrationController.crear);
router.patch('/:id', integrationController.actualizar);
router.delete('/:id', integrationController.eliminar);

export default router;
