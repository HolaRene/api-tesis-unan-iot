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

/*
 * ────────────────────────────────────────────────────────────────
 * RECOGIDA DE COMANDOS (Node-RED → equipo físico)
 * ────────────────────────────────────────────────────────────────
 * Estas dos rutas cierran el circuito de los actuadores:
 *
 *   1. GET /iot/comandos/pendientes
 *      Node-RED pregunta cada pocos segundos si hay órdenes nuevas. Se
 *      devuelven con el tema MQTT al que debe publicarlas.
 *
 *   2. PATCH /iot/comandos/:id
 *      Node-RED confirma la entrega ('enviado') y, si el equipo responde,
 *      la ejecución ('ejecutado'). En ese caso puede actualizar el estado
 *      real del actuador.
 *
 * Ambas exigen el permiso `comandos:enviar`.
 */

// Consulta de comandos pendientes de entrega
router.get(
  '/comandos/pendientes',
  verificarPermisosApi('comandos:enviar'),
  iotController.comandosPendientes
);

// Confirmación de entrega / ejecución de un comando
router.patch(
  '/comandos/:id',
  verificarPermisosApi('comandos:enviar'),
  iotController.confirmarComando
);

export default router;
