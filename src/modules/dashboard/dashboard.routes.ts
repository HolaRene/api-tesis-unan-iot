import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { autenticarJWT } from '../../middlewares/autenticar-jwt.middleware.js';

/**
 * Rutas del dashboard. El resumen se devuelve en UNA sola petición (query
 * dirigida) en vez de que el cliente haga varias llamadas.
 * Montadas bajo /api/v1/dashboard.
 */
const router = Router();

router.use(autenticarJWT);

router.get('/resumen', dashboardController.resumen);

export default router;
