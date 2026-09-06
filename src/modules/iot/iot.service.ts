import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ComandoIntegracionEntrada,
  IngestaMedicionesEntrada,
  ResultadoIngesta,
} from './iot.types.js';
import { measurementRepository } from '../measurements/measurement.repository.js';
import { measurementService } from '../measurements/measurement.service.js';
import { comandoActuadorService } from '../comandos-actuador/comando-actuador.service.js';

/** Fila con datos de un sensor y su tipo de dato para resolver la columna. */
interface SensorMapeo {
  id: string;
  codigo: string;
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

    // Carga los sensores que pertenecen a ese dispositivo (con su tipo de dato)
    const sensRes = await query<SensorMapeo>(
      `SELECT s.id, s.codigo, COALESCE(tv.tipo_dato, '') AS tipo_dato
       FROM sensores s
       LEFT JOIN tipos_variable tv ON tv.id = s.tipo_variable_id
       WHERE s.dispositivo_id = $1`,
      [dispositivoId]
    );
    const porCodigo = new Map(sensRes.rows.map((s) => [s.codigo, s]));

    let procesadas = 0;
    let fallidas = 0;
    const ids: unknown[] = [];

    for (const item of entrada.mediciones) {
      try {
        const sensor = porCodigo.get(item.sensor);
        if (!sensor) {
          throw new Error(`Sensor '${item.sensor}' no pertenece al dispositivo`);
        }

        const medicionInput = prepararMedicionPorTipo(sensor, item.valor);
        const medicion = await measurementRepository.crear({
          ...medicionInput,
          sensor_id: sensor.id,
          calidad: 'good',
          registrado_en: new Date(),
          metadatos: {
            ...(entrada.metadatos ?? {}),
            fuente: entrada.metadatos?.fuente ?? 'integracion',
            dispositivo: entrada.dispositivo,
            // Trazabilidad: dueño de la API Key que originó la integración.
            integracion_usuario: integracionUsuarioId,
          },
        });
        // Evalúa umbrales y dispara alertas si corresponde (valores numéricos)
        await measurementService.evaluarUmbrales(medicion);

        procesadas += 1;
        ids.push(medicion.id);
      } catch (error) {
        fallidas += 1;
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
