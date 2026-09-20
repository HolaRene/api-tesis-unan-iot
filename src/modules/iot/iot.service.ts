import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ComandoIntegracionEntrada,
  IngestaMedicionesEntrada,
  ResultadoIngesta,
} from './iot.types.js';
import { measurementService } from '../measurements/measurement.service.js';
import { comandoActuadorService } from '../comandos-actuador/comando-actuador.service.js';
import { deviceService } from '../devices/device.service.js';
import type { Device } from '../devices/device.types.js';
import {
  emitirDispositivoActualizado,
  emitirDispositivoOnline,
} from '../../realtime/dispositivos.eventos.js';
import {
  emitirCanalesActualizados,
  emitirMedicionNueva,
  type MedicionReciente,
} from '../../realtime/mediciones.eventos.js';

/** Fila con datos de un canal y su tipo de dato para resolver la columna. */
interface SensorMapeo {
  id: string;
  codigo: string;
  nombre: string | null;
  unidad: string | null;
  sensor_id: string | null;
  tipo_dato: string;
}

/**
 * Lógica de negocio de integración IoT (autenticada por API Key).
 *
 * Node-RED / integraciones NO conocen UUIDs internos: envían códigos lógicos
 * (identificador del dispositivo + códigos de sensores/actuadores).
 */
export const iotService = {
  /**
   * Procesa un lote de mediciones identificado por dispositivo/sensor (códigos).
   * Devuelve resumen procesadas/fallidas; un fallo en una medición no rompe el resto.
   */
  async ingestaMediciones(
    entrada: IngestaMedicionesEntrada,
    integracionUsuarioId: string
  ): Promise<ResultadoIngesta> {
    // Localiza el dispositivo por su identificador lógico
    const dispRes = await query<{ id: string }>(
      'SELECT id FROM dispositivos WHERE identificador = $1 LIMIT 1',
      [entrada.dispositivo]
    );
    if (dispRes.rows.length === 0) {
      throw ApiError.badRequest(
        `Dispositivo no encontrado por identificador: ${entrada.dispositivo}`
      );
    }
    const dispositivoId = dispRes.rows[0].id;

    // Carga los canales que pertenecen a sensores de ese dispositivo.
    // Se traen nombre/unidad/tipo_dato para poder parchear la UI en realtime
    // sin que el frontend tenga que hacer un refetch.
    const canalRes = await query<SensorMapeo>(
      `SELECT c.id, c.codigo, c.nombre, c.unidad, c.sensor_id,
              COALESCE(tv.tipo_dato, '') AS tipo_dato
       FROM canales c
       JOIN sensores s ON s.id = c.sensor_id
       LEFT JOIN tipos_variable tv ON tv.id = c.tipo_variable_id
       WHERE s.dispositivo_id = $1`,
      [dispositivoId]
    );
    const porCodigo = new Map(canalRes.rows.map((c) => [c.codigo, c]));

    let procesadas = 0;
    let fallidas = 0;
    const ids: unknown[] = [];
    // Mediciones guardadas (ya con COMMIT): se usan para emitir realtime.
    const guardadas: MedicionReciente[] = [];

    for (const item of entrada.mediciones) {
      try {
        const codigo = item.canal ?? item.sensor;
        if (!codigo) throw new Error('Cada medición debe indicar "canal" o "sensor"');
        const canal = porCodigo.get(codigo);
        if (!canal) {
          throw new Error(`Canal '${codigo}' no pertenece al dispositivo`);
        }

        const medicionInput = prepararMedicionPorTipo(canal, item.valor);
        const medicion = await measurementService.crear({
          ...medicionInput,
          canal_id: canal.id,
          calidad: 'good',
          registrado_en: new Date(),
          metadatos: {
            ...(entrada.metadatos ?? {}),
            fuente: entrada.metadatos?.fuente ?? 'integracion',
            dispositivo: entrada.dispositivo,
            integracion_usuario: integracionUsuarioId,
          },
        });

        procesadas += 1;
        ids.push(medicion.id);
        guardadas.push({
          id: medicion.id,
          canal_id: canal.id,
          canal_codigo: canal.codigo,
          canal_nombre: canal.nombre,
          canal_unidad: canal.unidad,
          canal_tipo_dato: canal.tipo_dato || null,
          sensor_id: canal.sensor_id,
          valor_numerico: medicion.valor_numerico ?? null,
          valor_texto: medicion.valor_texto ?? null,
          valor_booleano: medicion.valor_booleano ?? null,
          valor_json: medicion.valor_json ?? null,
          calidad: medicion.calidad,
          registrado_en: medicion.registrado_en
            ? new Date(medicion.registrado_en).toISOString()
            : null,
        });
      } catch (error) {
        fallidas += 1;
      }
    }

    // --- Realtime (SIEMPRE después del COMMIT de cada INSERT) ---
    // Las mediciones ya están persistidas: ahora se notifica.
    if (guardadas.length > 0) {
      emitirMedicionNueva(entrada.dispositivo, guardadas);
      emitirCanalesActualizados(guardadas);
    }

    // Si el dispositivo envió datos, está vivo: se marca online y se sella la
    // última conexión. Best-effort: un fallo aquí no invalida la ingesta.
    if (procesadas > 0) {
      try {
        const { anterior, actual } = await deviceService.registrarContacto(
          entrada.dispositivo
        );

        // Realtime DESPUÉS del COMMIT (registrarContacto ya confirmó el UPDATE).
        // Anti-ruido: en una medición normal el dispositivo ya estaba online, así
        // que NO se emite `dispositivo:online` ni `dispositivo:actualizado`.
        // Solo se emite cuando hay transición real (p. ej. offline → online).
        emitirDispositivoOnline(anterior, actual);
      } catch (error) {
        console.warn(
          `[iot] No se pudo registrar el contacto del dispositivo ${entrada.dispositivo}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return {
      proceso: 'mediciones',
      procesadas,
      fallidas,
      mediciones: ids,
    };
  },

  /**
   * Heartbeat de estado de un dispositivo (identificado por su código lógico).
   *
   * Permite a un PLC/ESP32/Raspberry reportar su estado real, IP y metadatos
   * (firmware, RSSI, uptime…) sin necesidad de enviar mediciones.
   *
   * Flujo: validar API Key + permiso (en la ruta) → actualizar PostgreSQL →
   * fusionar metadatos → COMMIT → emitir WebSocket.
   *
   * Eventos (anti-ruido):
   *   - `dispositivo:actualizado` solo si cambió IP, metadatos, estado, etc.
   *   - `dispositivo:online` además, solo si hubo transición a online.
   */
  async actualizarEstadoDispositivo(
    identificador: string,
    datos: {
      estado?: string;
      direccion_ip?: string | null;
      metadatos?: Record<string, unknown> | null;
    }
  ): Promise<{ anterior: Device; actual: Device }> {
    // El servicio actualiza y confirma; a partir de aquí ya hay COMMIT.
    const { anterior, actual } = await deviceService.registrarContacto(
      identificador,
      datos
    );

    // Emisión posterior al COMMIT.
    emitirDispositivoActualizado(anterior, actual);
    emitirDispositivoOnline(anterior, actual);

    return { anterior, actual };
  },

  /**
   * Registra un comando hacia un actuador identificado por su código.
   * La integración con API Key se autentica y verifica permiso en la ruta.
   */
  async comandoAUnActuador(
    entrada: ComandoIntegracionEntrada,
    integracion: { claveApiId: string }
  ) {
    return comandoActuadorService.crearDesdeIntegracion({
      clave_api_id: integracion.claveApiId,
      actuadorCodigo: entrada.actuador,
      comando: entrada.comando,
      valor: entrada.valor,
      metadatos: {
        fuente: 'integracion',
        ...(entrada.metadatos ?? {}),
      },
    });
  },
};

/**
 * Prepara el campo correcto de `mediciones` según el tipo de dato declarado
 * en el sensor (tipo_variable). `pg` guarda en una única columna por valor.
 */
function prepararMedicionPorTipo(
  sensor: SensorMapeo,
  valor: unknown
): {
  valor_numerico?: number;
  valor_texto?: string;
  valor_booleano?: boolean;
  valor_json?: Record<string, unknown>;
} {
  const tipo = sensor.tipo_dato.toLowerCase();

  switch (tipo) {
    case 'numeric':
    case 'integer':
    case 'real':
    case 'double':
      if (typeof valor !== 'number') {
        throw new Error(`El sensor '${sensor.codigo}' espera un valor numérico`);
      }
      return { valor_numerico: valor };
    case 'boolean':
    case 'bool':
      if (typeof valor !== 'boolean') {
        throw new Error(`El sensor '${sensor.codigo}' espera un valor booleano`);
      }
      return { valor_booleano: valor };
    case 'json':
    case 'object':
      if (typeof valor !== 'object' || valor === null) {
        throw new Error(`El sensor '${sensor.codigo}' espera un objeto JSON`);
      }
      return { valor_json: valor as Record<string, unknown> };
    case 'text':
    case 'varchar':
    case 'string':
    default:
      return { valor_texto: String(valor) };
  }
}
