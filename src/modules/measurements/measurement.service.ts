import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  CrearMeasurementInput,
  FiltrarMediciones,
  Measurement,
} from './measurement.types.js';
import { measurementRepository } from './measurement.repository.js';
import { alertRepository } from '../alerts/alert.repository.js';
import { alertService } from '../alerts/alert.service.js';
import { sensorRepository } from '../sensors/sensor.repository.js';
import { canalRepository } from '../canales/canal.repository.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

/** Estructura de un umbral activo obtenido para la evaluación. */
interface UmbralActivo {
  id: string;
  valor_min: string | null;
  valor_max: string | null;
  severidad: string | null;
}

/**
 * Lógica de negocio del módulo de mediciones.
 *
 * AISLAMIENTO: la medición hereda la propiedad del dispositivo de su canal.
 * Las operaciones de la API reciben el usuario; las de IoT no.
 */
export const measurementService = {
  /** Lista mediciones visibles para el usuario (filtros opcionales). */
  async listar(
    filtro: FiltrarMediciones,
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement[]> {
    return measurementRepository.listar(filtro, usuario);
  },

  /**
   * Devuelve el historial de un sensor (orden ascendente para gráfica).
   * Si se pasa `usuario`, solo si el sensor es visible.
   */
  async listarHistorialSensor(
    sensorId: string,
    filtro: { desde?: string; hasta?: string; limite?: number },
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement[]> {
    if (usuario) {
      const sensor = await sensorRepository.buscarPorId(sensorId, usuario);
      if (!sensor) throw ApiError.notFound('Sensor no encontrado');
    }
    return measurementRepository.listarHistorialSensor(sensorId, filtro);
  },

  /**
   * Devuelve el historial de un canal (orden ascendente para gráfica).
   * Si se pasa `usuario`, solo si el canal es visible.
   */
  async listarCanalPorId(
    canalId: string,
    filtro: { desde?: string; hasta?: string; limite?: number },
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement[]> {
    if (usuario) {
      const canal = await canalRepository.buscarPorId(canalId, usuario);
      if (!canal) throw ApiError.notFound('Canal no encontrado');
    }
    return measurementRepository.listarHistorialCanal(canalId, filtro);
  },

  /**
   * Obtiene una medición por id (solo si es visible para el usuario).
   */
  async obtenerPorId(
    id: number,
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement> {
    const medicion = await measurementRepository.buscarPorId(id, usuario);
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
    if (entrada.sensor_id) await this.verificarSensor(entrada.sensor_id);
    const medicion = await measurementRepository.crear(entrada);
    if (medicion.canal_id) await alertService.evaluarMedicion(medicion);
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
