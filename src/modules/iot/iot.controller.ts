import type { NextFunction, Request, Response } from 'express';
import { responderExito } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';
import {
  comandoIntegracionSchema,
  estadoDispositivoSchema,
  ingestaMedicionesSchema,
} from './iot.schema.js';
import {
  confirmarComandoSchema,
  idComandoParamSchema,
  listarPendientesSchema,
} from '../comandos-actuador/comando-actuador.schema.js';
import { comandoActuadorService } from '../comandos-actuador/comando-actuador.service.js';
import { iotService } from './iot.service.js';

/**
 * Controlador del módulo IoT (rutas de integración con API Key).
 * `req.claveApi` ya fue inyectado por `autenticarApiKey`.
 */
export const iotController = {
  /**
   * POST /api/v1/iot/mediciones
   * Requiere permiso mediciones:crear.
   */
  async ingestaMediciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = ingestaMedicionesSchema.parse(req.body);
      if (!req.claveApi) {
        next(ApiError.unauthorized('No autenticado con API Key'));
        return;
      }
      const resultado = await iotService.ingestaMediciones(
        entrada,
        req.claveApi.usuarioId
      );
      responderExito(res, resultado, 201, 'Mediciones procesadas');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/iot/comandos
   * Requiere permiso comandos:enviar.
   */
  async comandoActuador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entrada = comandoIntegracionSchema.parse(req.body);
      if (!req.claveApi) {
        next(ApiError.unauthorized('No autenticado con API Key'));
        return;
      }
      const comando = await iotService.comandoAUnActuador(entrada, {
        claveApiId: req.claveApi.claveApiId,
      });
      responderExito(res, comando, 201, 'Comando registrado correctamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/iot/dispositivos/:identificador/estado
   * Requiere permiso estado:actualizar.
   *
   * Heartbeat: el equipo reporta su estado real (online/offline/error…), su IP
   * y metadatos libres (firmware, RSSI, uptime…). Actualiza el dispositivo para
   * que la web muestre información real.
   */
  async estadoDispositivo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Express 5 tipa los params como string | string[]; normalizamos.
      const identificador = Array.isArray(req.params.identificador)
        ? req.params.identificador[0]
        : req.params.identificador;
      if (!identificador) {
        next(ApiError.badRequest('El identificador del dispositivo es obligatorio'));
        return;
      }
      const entrada = estadoDispositivoSchema.parse(req.body);
      const { actual } = await iotService.actualizarEstadoDispositivo(
        identificador,
        entrada
      );
      responderExito(res, actual, 200, 'Estado del dispositivo actualizado');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/iot/comandos/pendientes
   *
   * Devuelve las órdenes que la web ha encolado y que aún no se han entregado.
   *
   * Lo pueden llamar:
   *   - Node-RED, sin filtros: recoge todas las órdenes de la instalación.
   *   - Un equipo concreto (ESP32 con buzzer, PLC…), indicando su
   *     `identificador` para recibir SOLO las suyas.
   *
   * Requiere el permiso `comandos:enviar`.
   */
  async comandosPendientes(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limite, identificador, actuador } = listarPendientesSchema.parse(
        req.query
      );
      const comandos = await comandoActuadorService.listarPendientes(
        { identificador, actuadorCodigo: actuador },
        limite ?? 50
      );
      responderExito(res, comandos, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/iot/comandos/:id
   *
   * Confirma la entrega de un comando. Node-RED lo llama después de publicar
   * en MQTT y, si el equipo responde, otra vez con estado 'ejecutado'.
   *
   * Requiere el permiso `comandos:enviar`.
   */
  async confirmarComando(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Express 5 tipa los params como string | string[]; normalizamos.
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { id: comandoId } = idComandoParamSchema.parse({ id });
      const entrada = confirmarComandoSchema.parse(req.body);

      const comando = await comandoActuadorService.confirmar(comandoId, entrada);
      responderExito(res, comando, 200, 'Comando actualizado');
    } catch (error) {
      next(error);
    }
  },
};
