import { Router } from 'express';
import { variableTypeController } from './variable-type.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de tipos de variable, montadas bajo /api/v1/variable-types.
 * Requieren autenticación JWT.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', variableTypeController.listar);
router.get('/:id', variableTypeController.obtenerPorId);
router.post('/', variableTypeController.crear);
router.patch('/:id', variableTypeController.actualizar);
router.delete('/:id', variableTypeController.eliminar);

export default router;
