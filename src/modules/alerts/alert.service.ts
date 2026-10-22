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
import { cumpleCondicion, decidirConRetardo } from './motor-alertas.js';
import { evaluarUmbral } from '../iot/falla-lazo.js';
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

    /*
     * Una medición en FALLA no se evalúa contra umbrales.
     *
     * Un sensor averiado entrega -32768 o < 3,6 mA. Comparar ese valor con
     * «temperatura < 18 °C» abre una alarma que describe mal el problema: el
     * sensor está roto, no hace frío.
     *
     * En su lugar se abre una alerta de tipo `falla_lazo`, que el operario
     * reconoce como distinta de una desviación de proceso.
     */
    if (!evaluarUmbral(medicion.calidad)) {
      await this.registrarFallaLazo(medicion);
      return;
    }

    // Al volver a leer bien, se cierra la falla (si la había).
    await this.resolverFallaLazo(medicion);

    const reglas = await reglaRepository.listar({ canal_id: medicion.canal_id, activa: true });
    for (const regla of reglas) {
      /*
       * Motor con retardo e histéresis (ISA-18.2).
       *
       * Antes bastaba `evaluarRegla`: si cumple abre, si no cierra. Eso
       * hacía que cualquier valor oscilando en el borde generase una alerta
       * por medición.
       *
       * Ahora se decide en tres pasos:
       *   - Si hay alerta abierta: se mantiene mientras el valor siga en la
       *     zona de alarma AMPLIADA por la histéresis, y solo se resuelve al
       *     volver de verdad a la banda.
       *   - Si no la hay y la condición se cumple: se arranca (o se consulta)
       *     el cronómetro del retardo.
       *   - Solo se abre cuando el cronómetro supera `retardo_segundos`.
       */
      const activa = await alertRepository.buscarActivaPorRegla(regla.id);
      const valorNumerico = medicion.valor_numerico;

      let decision: ReturnType<typeof decidirConRetardo>;

      if (cumpleCondicion(regla, valorNumerico)) {
        // La condición se cumple: el cronómetro corre desde la primera vez.
        await alertRepository.marcarInicioRetardo(regla.id);
      }

      const desde = activa ? null : await alertRepository.obtenerInicioRetardo(regla.id);

      decision = decidirConRetardo(
        regla,
        valorNumerico,
        new Date(medicion.registrado_en ?? Date.now()),
        activa ? { estado: activa.estado, iniciada_en: activa.iniciada_en } : null,
        desde
      );

      if (decision.accion === 'abrir') {
        {
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
          // Al abrir, el cronómetro deja de tener sentido.
          await alertRepository.limpiarInicioRetardo(regla.id);
        }
        // Ya había una alerta activa para la regla: NO se duplica el evento.
      } else if (decision.accion === 'resolver') {
        // Al dejar de cumplirse, se resuelven las activas de esa regla.
        // `resolverPorRegla` devuelve solo las que realmente cambiaron, así que
        // reejecutar sin cambios no emite nada.
        const resueltas = await alertRepository.resolverPorRegla(regla.id);
        for (const resuelta of resueltas) {
          emitirAlertaResuelta(resuelta);
        }
        await alertRepository.limpiarInicioRetardo(regla.id);
      } else if (decision.accion === 'nada') {
        // No se cumple y no había alerta: se descarta el cronómetro, si lo hubiera.
        await alertRepository.limpiarInicioRetardo(regla.id);
      }
      // 'esperar' y 'mantener': no se hace nada hasta la próxima medición.
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
/**
 * Abre la alerta de falla de lazo si aún no hay una.
   *
   * Deduplicación: mientras la falla siga activa solo puede haber UNA
   * alerta abierta por canal. Sin esto, cada lectura de -32768 (cada 15 s)
   * crearía una alerta nueva y llenaría la lista.
   */
  async registrarFallaLazo(medicion: Measurement): Promise<void> {
    if (!medicion.canal_id) return;
    const abierta = await alertRepository.buscarFallaLazoAbierta(medicion.canal_id);
    if (abierta) return;

    const motivo =
      (medicion.metadatos as Record<string, unknown> | null)?.motivo_calidad;
    const mensaje =
      typeof motivo === 'string'
        ? `Falla de lazo en el sensor: ${motivo}`
        : 'Falla de lazo en el sensor';

    // La falla de instrumento es siempre crítica: el dato no es fiable.
    const creada = await alertRepository.crearFallaLazo({
      canal_id: medicion.canal_id,
      medicion_id: medicion.id ?? null,
      severidad: 'critical',
      mensaje,
      motivo: typeof motivo === 'string' ? motivo : null,
    });
    // Persistida (COMMIT) antes de emitir.
    emitirAlertaCreada(creada);
  },

  /** Cierra la falla de lazo cuando el sensor vuelve a entregar medidas válidas. */
  async resolverFallaLazo(medicion: Measurement): Promise<void> {
    if (!medicion.canal_id) return;
    const resueltas = await alertRepository.resolverFallaLazo(medicion.canal_id);
    for (const resuelta of resueltas) emitirAlertaResuelta(resuelta);
  },
};

/** Evalúa si la regla (según tipo de dato del canal) se cumple con la medición. */

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


