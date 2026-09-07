import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAlertInput,
  Alert,
  CrearAlertInput,
} from './alert.types.js';
import { alertRepository } from './alert.repository.js';
import { reglaRepository } from '../reglas-alerta/regla-alerta.repository.js';
import type { Measurement } from '../measurements/measurement.types.js';

/**
 * Lógica de negocio del módulo de alertas.
 */
export const alertService = {
  /**
   * Lista todas las alertas.
   */
  async listar(): Promise<Alert[]> {
    return alertRepository.listar();
  },

  /**
   * Obtiene una alerta por id.
   */
  async obtenerPorId(id: string): Promise<Alert> {
    const alerta = await alertRepository.buscarPorId(id);
    if (!alerta) {
      throw ApiError.notFound('Alerta no encontrada');
    }
    return alerta;
  },

  /**
   * Crea una alerta. Valida sensor y medición si se proporcionan.
   */
  async crear(entrada: CrearAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    return alertRepository.crear(entrada);
  },

  /**
   * Actualiza una alerta por id.
   */
  async actualizar(id: string, entrada: ActualizarAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    const actualizada = await alertRepository.actualizar(id, entrada);
    if (!actualizada) {
      throw ApiError.notFound('Alerta no encontrada');
    }
    return actualizada;
  },

  /**
   * Elimina una alerta por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminada = await alertRepository.eliminar(id);
    if (!eliminada) {
      throw ApiError.notFound('Alerta no encontrada');
    }
  },

  /**
   * Valida que el sensor y la medición referenciados existan.
   */
  async validarExistencias(sensorId?: string | null, medicionId?: number | null): Promise<void> {
    if (sensorId) {
      const sensor = await query<{ id: string }>(
        'SELECT id FROM sensores WHERE id = $1 LIMIT 1',
        [sensorId]
      );
      if (sensor.rows.length === 0) {
        throw ApiError.badRequest(`El sensor con id ${sensorId} no existe`);
      }
    }
    if (medicionId) {
      const medicion = await query<{ id: number }>(
        'SELECT id FROM mediciones WHERE id = $1 LIMIT 1',
        [medicionId]
      );
      if (medicion.rows.length === 0) {
        throw ApiError.badRequest(`La medición con id ${medicionId} no existe`);
      }
    }
  },

  /**
   * Evalúa una medición contra las reglas activas de su canal (modelo multivariable).
   */
  async evaluarMedicion(medicion: Measurement): Promise<void> {
    if (!medicion.canal_id) return;
    const reglas = await reglaRepository.listar({ canal_id: medicion.canal_id, activa: true });
    for (const regla of reglas) {
      const cumple = evaluarRegla(regla, medicion);
      if (cumple) {
        const activa = await alertRepository.buscarActivaPorRegla(regla.id);
        if (!activa) {
          const valor = valorDisparador(regla, medicion);
          await alertRepository.crearDesdeRegla({
            regla_id: regla.id,
            canal_id: medicion.canal_id,
            medicion_id: medicion.id,
            severidad: regla.severidad,
            mensaje: regla.mensaje || `Regla '${regla.nombre}' cumplida`,
            ...valor,
          });
        }
      } else {
        await alertRepository.resolverPorRegla(regla.id);
      }
    }
  },

  /** PATCH /alerts/:id/reconocer (estado reconocida; la condición puede seguir). */
  async reconocer(id: string, usuarioId?: string): Promise<Alert> {
    const alerta = await alertRepository.buscarPorId(id);
    if (!alerta) throw ApiError.notFound('Alerta no encontrada');
    const actualizada = await alertRepository.actualizar(id, {
      estado: 'acknowledged',
      reconocida_en: new Date(),
      reconocida_por: usuarioId,
    });
    return actualizada ?? alerta;
  },
};

/** Evalúa si la regla (según tipo de dato del canal) se cumple con la medición. */
function evaluarRegla(
  regla: import('../reglas-alerta/regla-alerta.types.js').FilaReglaDetalle,
  m: Measurement
): boolean {
  const tipo = (regla.tipo_dato ?? 'text').toLowerCase();
  if (tipo === 'numeric') {
    const v = m.valor_numerico;
    if (v === null || v === undefined) return false;
    const o = regla.operador;
    if (o === '>') return v > (regla.valor_referencia_numerico ?? 0);
    if (o === '>=') return v >= (regla.valor_referencia_numerico ?? 0);
    if (o === '<') return v < (regla.valor_referencia_numerico ?? 0);
    if (o === '<=') return v <= (regla.valor_referencia_numerico ?? 0);
    if (o === '=') return v === (regla.valor_referencia_numerico ?? 0);
    if (o === 'entre')
      return regla.valor_min !== null && regla.valor_max !== null && v >= regla.valor_min && v <= regla.valor_max;
    if (o === 'fuera_de_rango')
      return regla.valor_min !== null && regla.valor_max !== null && (v < regla.valor_min || v > regla.valor_max);
    return false;
  }
  if (tipo === 'boolean') {
    const b = m.valor_booleano;
    if (regla.operador === 'es_true') return b === true;
    if (regla.operador === 'es_false') return b === false;
    return false;
  }
  const texto = (m.valor_texto ?? '').toString();
  const ref = (regla.valor_referencia_texto ?? '').toString();
  if (regla.operador === 'igual_a') return texto === ref;
  if (regla.operador === 'diferente_de') return texto !== ref;
  if (regla.operador === 'contiene') return texto.includes(ref);
  return false;
}

/** Valor disparador de la alerta según tipo de dato. */
function valorDisparador(
  regla: import('../reglas-alerta/regla-alerta.types.js').FilaReglaDetalle,
  m: Measurement
): { valor_numerico: number | null; valor_texto: string | null; valor_booleano: boolean | null } {
  const tipo = (regla.tipo_dato ?? 'text').toLowerCase();
  if (tipo === 'numeric') return { valor_numerico: m.valor_numerico ?? null, valor_texto: null, valor_booleano: null };
  if (tipo === 'boolean') return { valor_numerico: null, valor_texto: null, valor_booleano: m.valor_booleano ?? null };
  return { valor_numerico: null, valor_texto: m.valor_texto ?? null, valor_booleano: null };
}

