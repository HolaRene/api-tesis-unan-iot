import { Router } from 'express';
import { iotController } from './iot.controller.js';
import { autenticarApiKey } from '../../middlewares/autenticar-api-key.middleware.js';
import { verificarPermisosApi } from '../../middlewares/verificar-permiso-api.middleware.js';

/**
 * Rutas de integración IoT, montadas bajo /api/v1/iot.
 *
 * Se autentican con API Key (header `X-API-Key`), no con JWT web.
 * Cada endpoint exige un permiso específico de la clave.
 */
const router = Router();

// Toda la ruta IoT exige una API Key válida
router.use(autenticarApiKey);

// Ingesta de mediciones por código lógico
router.post(
  '/mediciones',
  verificarPermisosApi('mediciones:crear'),
  iotController.ingestaMediciones
);

// Envío de comando a un actuador por código lógico
router.post(
  '/comandos',
  verificarPermisosApi('comandos:enviar'),
  iotController.comandoActuador
);

// Heartbeat/estado del dispositivo (PLC, ESP32, Raspberry…) por código lógico
router.post(
  '/dispositivos/:identificador/estado',
  verificarPermisosApi('estado:actualizar'),
  iotController.estadoDispositivo
);

export default router;
