import { Router } from 'express';
import { camaraController } from './camera.controller.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';

/**
 * Rutas del módulo de cámaras IP, montadas bajo /api/v1/camaras.
 *
 * Autenticación: JWT (middlewareAuth).
 * Lectura: cualquier usuario autenticado (el alcance lo filtra el service).
 * Escritura: roles `usuario` y `admin` (igual que el resto de entidades).
 *
 * IMPORTANTE: estas rutas solo administran METADATOS de la cámara.
 * El vídeo NO pasa por aquí: va cámara → RTSP → MediaMTX → WebRTC → navegador.
 */
const router = Router();

router.use(middlewareAuth);

router.get('/', camaraController.listar);
router.get('/:id', camaraController.obtenerPorId);

router.post('/', requiereRol('usuario', 'admin'), camaraController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), camaraController.actualizar);
router.patch(
  '/:id/estado',
  requiereRol('usuario', 'admin'),
  camaraController.actualizarEstado
);
router.delete('/:id', requiereRol('usuario', 'admin'), camaraController.eliminar);

export default router;
