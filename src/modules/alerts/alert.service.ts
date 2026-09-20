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
import {
  emitirAlertaCreada,
  emitirAlertaResuelta,
  emitirCambioDeAlerta,
} from '../../realtime/alertas.eventos.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del módulo de alertas.
 */
export const alertService = {
  /**
   * Lista las alertas visibles para el usuario.
   */
  async listar(usuario?: UsuarioAlcance | null): Promise<Alert[]> {
    return alertRepository.listar(usuario);
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
   * Emite `alerta:creada` tras el COMMIT.
   */
  async crear(entrada: CrearAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    const alerta = await alertRepository.crear(entrada);
    emitirAlertaCreada(alerta);
    return alerta;
  },

  /**
   * Actualiza una alerta por id.
   *
   * Emite un único evento coherente con el nuevo estado:
   *   - `alerta:resuelta` si pasa a `resolved` (no se emite además
   *     `alerta:actualizada`, para no duplicar).
   *   - `alerta:actualizada` en cualquier otro caso (reconocida, severidad…).
   */
  async actualizar(id: string, entrada: ActualizarAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    const actualizada = await alertRepository.actualizar(id, entrada);
    if (!actualizada) {
      throw ApiError.notFound('Alerta no encontrada');
    }
    emitirCambioDeAlerta(actualizada);
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
          // La alerta ya está persistida (COMMIT): se emite ahora.
          const creada = await alertRepository.crearDesdeRegla({
            regla_id: regla.id,
            canal_id: medicion.canal_id,
            medicion_id: medicion.id,
            severidad: regla.severidad,
            mensaje: regla.mensaje || `Regla '${regla.nombre}' cumplida`,
            ...valor,
          });
          emitirAlertaCreada(creada);
        }
        // Ya había una alerta activa para la regla: NO se duplica el evento.
      } else {
        // Al dejar de cumplirse, se resuelven las activas de esa regla.
        // `resolverPorRegla` devuelve solo las que realmente cambiaron, así que
        // reejecutar sin cambios no emite nada.
        const resueltas = await alertRepository.resolverPorRegla(regla.id);
        for (const resuelta of resueltas) {
          emitirAlertaResuelta(resuelta);
        }
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
    const resultado = actualizada ?? alerta;
    emitirCambioDeAlerta(resultado);
    return resultado;
  },

  /** PATCH /alerts/:id/resolver (pasa a `resolved` y se emite `alerta:resuelta`). */
  async resolver(id: string): Promise<Alert> {
    const alerta = await alertRepository.buscarPorId(id);
    if (!alerta) throw ApiError.notFound('Alerta no encontrada');
    const actualizada = await alertRepository.actualizar(id, {
      estado: 'resolved',
      finalizada_en: new Date(),
    });
    const resultado = actualizada ?? alerta;
    emitirAlertaResuelta(resultado);
    return resultado;
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

