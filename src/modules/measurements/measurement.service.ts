import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  CrearMeasurementInput,
  FiltrarMediciones,
  Measurement,
} from './measurement.types.js';
import { measurementRepository } from './measurement.repository.js';
import { alertRepository } from '../alerts/alert.repository.js';

/** Estructura de un umbral activo obtenido para la evaluación. */
interface UmbralActivo {
  id: string;
  valor_min: string | null;
  valor_max: string | null;
  severidad: string | null;
}

/**
 * Lógica de negocio del módulo de mediciones.
 */
export const measurementService = {
  /**
   * Lista mediciones con filtros opcionales.
   */
  async listar(filtro: FiltrarMediciones): Promise<Measurement[]> {
    return measurementRepository.listar(filtro);
  },

  /**
   * Devuelve el historial de un sensor (orden ascendente para gráfica).
   */
  async listarHistorialSensor(
    sensorId: string,
    filtro: { desde?: string; hasta?: string; limite?: number }
  ): Promise<Measurement[]> {
    return measurementRepository.listarHistorialSensor(sensorId, filtro);
  },

  /**
   * Obtiene una medición por id.
   */
  async obtenerPorId(id: number): Promise<Measurement> {
    const medicion = await measurementRepository.buscarPorId(id);
    if (!medicion) {
      throw ApiError.notFound('Medición no encontrada');
    }
    return medicion;
  },

  /**
   * Registra (ingiere) una nueva medición.
   * Valida que el sensor exista y evalúa los umbrales activos para
   * generar alertas automáticas si el valor queda fuera del rango.
   */
  async crear(entrada: CrearMeasurementInput): Promise<Measurement> {
    await this.verificarSensor(entrada.sensor_id);
    const medicion = await measurementRepository.crear(entrada);
    await this.evaluarUmbrales(medicion);
    return medicion;
  },

  /**
   * Elimina una medición por id.
   */
  async eliminar(id: number): Promise<void> {
    const eliminada = await measurementRepository.eliminar(id);
    if (!eliminada) {
      throw ApiError.notFound('Medición no encontrada');
    }
  },

  /**
   * Verifica que exista un sensor con el id dado.
   */
  async verificarSensor(sensorId: string): Promise<void> {
    const resultado = await query<{ id: string }>(
      'SELECT id FROM sensores WHERE id = $1 LIMIT 1',
      [sensorId]
    );
    if (resultado.rows.length === 0) {
      throw ApiError.badRequest(`El sensor con id ${sensorId} no existe`);
    }
  },

  /**
   * Evalúa los umbrales activos del sensor de la medición y genera una
   * alerta si el valor numérico está fuera del rango configurado.
   */
  async evaluarUmbrales(medicion: Measurement): Promise<void> {
    if (medicion.valor_numerico === null) {
      return;
    }

    const umbrales = await query<UmbralActivo>(
      `SELECT id, valor_min, valor_max, severidad
       FROM umbrales
       WHERE sensor_id = $1 AND activo = TRUE`,
      [medicion.sensor_id]
    );

    const valor = medicion.valor_numerico;

    for (const umbral of umbrales.rows) {
      const bajoMinimo =
        umbral.valor_min !== null && valor < Number(umbral.valor_min);
      const sobreMaximo =
        umbral.valor_max !== null && valor > Number(umbral.valor_max);

      if (!bajoMinimo && !sobreMaximo) {
        continue;
      }

      const limite =
        (umbral.valor_min !== null ? `mín ${umbral.valor_min}` : '') +
        (umbral.valor_min !== null && umbral.valor_max !== null ? ' y ' : '') +
        (umbral.valor_max !== null ? `máx ${umbral.valor_max}` : '');

      await alertRepository.crear({
        sensor_id: medicion.sensor_id,
        medicion_id: medicion.id,
        tipo: 'umbral',
        severidad: umbral.severidad ?? 'media',
        mensaje: `Valor ${valor} fuera del rango (${limite})`,
        estado: 'active',
        metadatos: {
          umbral_id: umbral.id,
          valor: valor,
        },
      });
    }
  },
};
