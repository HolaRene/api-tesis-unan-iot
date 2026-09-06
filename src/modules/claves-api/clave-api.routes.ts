import { Router } from 'express';
import { claveApiController } from './clave-api.controller.js';
import { middlewareAuth as autenticarJWT } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de API Keys (usuario/web, autenticadas con JWT).
 * Montadas bajo /api/v1/claves-api.
 *
 * Cualquier usuario autenticado gestiona SUS propias claves (se filtra por
 * `req.usuario`, no se exponen claves de otros usuarios).
 */
const router = Router();

router.use(autenticarJWT);

router.get('/', claveApiController.listar);
router.post('/', claveApiController.crear);
router.delete('/:id', claveApiController.revocar);

export default router;
