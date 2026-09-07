import { Router } from 'express';
import { canalController } from './canal.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';

/** Rutas de canales montadas bajo /api/v1/canales (requieren JWT). */
const router = Router();
router.use(middlewareAuth);

router.get('/', canalController.listar);
router.get('/:id/mediciones', canalController.historialMediciones);
router.get('/:id', canalController.obtenerPorId);
router.post('/', requiereRol('usuario', 'admin'), canalController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), canalController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), canalController.eliminar);

export default router;
