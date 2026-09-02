import { Router } from 'express';
import { healthController } from './health.controller.js';

/**
 * Rutas del módulo de salud, montadas bajo /api/v1.
 */
const router = Router();

router.get('/health', healthController.verificar);

export default router;
