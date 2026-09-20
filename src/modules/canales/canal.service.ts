import { ApiError } from '../../utils/api-error.js';
import { query } from '../../database/pool.js';
import { canalRepository } from './canal.repository.js';
import type {
  FilaCanalDetalle,
  CrearCanalInput,
  ActualizarCanalInput,
  FiltroCanales,
} from './canal.types.js';
import type { MagnitudSensorInput } from '../sensors/sensor.types.js';
import { measurementService } from '../measurements/measurement.service.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

/** Normaliza un valor numérico opcional ('' | null | undefined -> null). */
function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export const canalService = {
  /** Lista canales visibles para el usuario (filtros opcionales). */
  async listar(
    filtro?: FiltroCanales,
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle[]> {
    return canalRepository.listar(filtro, usuario);
  },

  /** Canal por id (404 si no existe o no es visible para el usuario). */
  async obtenerPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle> {
    const c = await canalRepository.buscarPorId(id, usuario);
    if (!c) throw ApiError.notFound('Canal no encontrado');
    return c;
  },

  /**
   * Crea un canal. Valida que el código sea único y que, si se indican,
   * sensor y tipo_variable existan. NO exige sensor (se permite canal
   * independiente provisional para compatibilidad).
   */
  async crear(entrada: CrearCanalInput): Promise<FilaCanalDetalle> {
    const conMismoCodigo = await canalRepository.buscarPorCodigo(entrada.codigo);
    if (conMismoCodigo) throw ApiError.conflict('Ya existe un canal con ese código');
    return canalRepository.crear(entrada);
  },

  /**
   * Crea los canales (magnitudes) de un sensor.
   *
   * - Si `magnitudes` trae elementos, crea un canal por cada uno.
   * - Si no, crea un único canal a partir de la magnitud principal del sensor
   *   (`tipo_variable_id`), conservando el comportamiento anterior.
   *
   * El `codigo` de cada canal se toma de la magnitud si viene; si no, se
   * deriva del código del sensor (+ sufijo del tipo de variable para que sea
   * único cuando hay varias magnitudes).
   */
  async crearCanalesDeSensor(sensor: {
    id: string;
    codigo: string;
    nombre: string;
    tipo_variable_id?: string | null;
    unidad?: string | null;
    rango_min?: number | string | null;
    rango_max?: number | string | null;
    precision?: number | string | null;
    activo?: boolean;
    magnitudes?: MagnitudSensorInput[];
  }): Promise<FilaCanalDetalle[]> {
    const magnitudes =
      sensor.magnitudes && sensor.magnitudes.length > 0
        ? sensor.magnitudes
        : sensor.tipo_variable_id
          ? [
              {
                tipo_variable_id: sensor.tipo_variable_id,
                unidad: sensor.unidad ?? null,
                rango_min: aNumero(sensor.rango_min),
                rango_max: aNumero(sensor.rango_max),
                precision_valor: aNumero(sensor.precision),
              },
            ]
          : [];

    const creados: FilaCanalDetalle[] = [];
    for (const magnitud of magnitudes) {
      const tipo = await this.obtenerTipoVariable(magnitud.tipo_variable_id);
      const sufijo = tipo?.codigo ? `-${tipo.codigo}` : '';
      const codigo = await this.codigoDisponible(
        (magnitud.codigo ?? `${sensor.codigo}${sufijo}`).trim()
      );

      const canal = await canalRepository.crear({
        sensor_id: sensor.id,
        tipo_variable_id: magnitud.tipo_variable_id,
        codigo,
        nombre:
          magnitud.nombre?.trim() ||
          `${sensor.nombre} · ${tipo?.nombre ?? 'magnitud'}`,
        descripcion:
          'Canal generado automáticamente a partir de las magnitudes del sensor.',
        unidad: magnitud.unidad ?? tipo?.unidad_default ?? null,
        rango_min: aNumero(magnitud.rango_min),
        rango_max: aNumero(magnitud.rango_max),
        precision_valor: aNumero(magnitud.precision_valor),
        activo: magnitud.activo ?? sensor.activo ?? true,
      });
      creados.push(canal);
    }
    return creados;
  },

  /**
   * Sincroniza las magnitudes de un sensor al editarlo.
   *
   * - Los canales existentes cuyo `tipo_variable_id` coincide con una magnitud
   *   enviada se actualizan (unidad, rango, precisión, estado).
   * - Las magnitudes nuevas se crean.
   * - Si el sensor no tiene ningún canal, se crean.
   *
   * No elimina canales existentes (para no perder mediciones/reglas): eso se
   * hace aparte con `DELETE /canales/:id`.
   */
  async sincronizarDesdeSensor(sensor: {
    id: string;
    codigo: string;
    nombre: string;
    tipo_variable_id?: string | null;
    unidad?: string | null;
    rango_min?: number | string | null;
    rango_max?: number | string | null;
    precision?: number | string | null;
    activo?: boolean;
    magnitudes?: MagnitudSensorInput[];
  }): Promise<void> {
    const existentes = await canalRepository.listar({ sensor_id: sensor.id });

    // Sin magnitudes declaradas: mantiene/crea el canal de la magnitud principal.
    if (!sensor.magnitudes || sensor.magnitudes.length === 0) {
      if (existentes.length === 0) {
        await this.crearCanalesDeSensor(sensor);
        return;
      }
      const principal = existentes[0];
      await canalRepository.actualizar(principal.id, {
        tipo_variable_id: sensor.tipo_variable_id ?? principal.tipo_variable_id ?? null,
        unidad: sensor.unidad ?? principal.unidad ?? null,
        rango_min: aNumero(sensor.rango_min),
        rango_max: aNumero(sensor.rango_max),
        precision_valor: aNumero(sensor.precision),
        activo: sensor.activo ?? principal.activo,
      });
      return;
    }

    for (const magnitud of sensor.magnitudes) {
      const tipo = await this.obtenerTipoVariable(magnitud.tipo_variable_id);
      const existente = existentes.find(
        (c) => c.tipo_variable_id === magnitud.tipo_variable_id
      );

      if (existente) {
        await canalRepository.actualizar(existente.id, {
          unidad: magnitud.unidad ?? tipo?.unidad_default ?? existente.unidad ?? null,
          rango_min: aNumero(magnitud.rango_min),
          rango_max: aNumero(magnitud.rango_max),
          precision_valor: aNumero(magnitud.precision_valor),
          activo: magnitud.activo ?? sensor.activo ?? existente.activo,
        });
      } else {
        const sufijo = tipo?.codigo ? `-${tipo.codigo}` : '';
        const codigo = await this.codigoDisponible(
          (magnitud.codigo ?? `${sensor.codigo}${sufijo}`).trim()
        );
        await canalRepository.crear({
          sensor_id: sensor.id,
          tipo_variable_id: magnitud.tipo_variable_id,
          codigo,
          nombre:
            magnitud.nombre?.trim() ||
            `${sensor.nombre} · ${tipo?.nombre ?? 'magnitud'}`,
          descripcion:
            'Canal generado automáticamente a partir de las magnitudes del sensor.',
          unidad: magnitud.unidad ?? tipo?.unidad_default ?? null,
          rango_min: aNumero(magnitud.rango_min),
          rango_max: aNumero(magnitud.rango_max),
          precision_valor: aNumero(magnitud.precision_valor),
          activo: magnitud.activo ?? sensor.activo ?? true,
        });
      }
    }
  },

  /** Devuelve el tipo de variable (código/nombre/unidad) o null si no existe. */
  async obtenerTipoVariable(id: string) {
    const r = await query<{
      id: string;
      codigo: string;
      nombre: string;
      unidad_default: string | null;
    }>(
      'SELECT id, codigo, nombre, unidad_default FROM tipos_variable WHERE id = $1 LIMIT 1',
      [id]
    );
    return r.rows[0] ?? null;
  },

  /** Genera un código de canal libre añadiendo sufijo numérico si ya existe. */
  async codigoDisponible(base: string): Promise<string> {
    let candidato = base;
    let intento = 1;
    while (await canalRepository.buscarPorCodigo(candidato)) {
      intento += 1;
      candidato = `${base}-${intento}`;
    }
    return candidato;
  },

  async actualizar(
    id: string,
    entrada: ActualizarCanalInput,
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle> {
    await this.obtenerPorId(id, usuario); // 404 si no tiene acceso

    if (entrada.codigo) {
      const existente = await canalRepository.buscarPorCodigo(entrada.codigo);
      if (existente && existente.id !== id)
        throw ApiError.conflict('Ya existe otro canal con ese código');
    }
    const actualizado = await canalRepository.actualizar(id, entrada, usuario);
    if (!actualizado)
      throw ApiError.forbidden('No tiene permisos para modificar este canal');
    return actualizado;
  },

  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const ok = await canalRepository.eliminar(id, usuario);
    if (!ok) {
      const existe = await canalRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para eliminar este canal');
      }
      throw ApiError.notFound('Canal no encontrado');
    }
  },

  /**
   * Historial de mediciones de un canal.
   * El canal debe ser visible para el usuario (404 si no).
   */
  async historialMediciones(
    id: string,
    filtro: { desde?: string; hasta?: string; limite?: number },
    usuario?: UsuarioAlcance | null
  ) {
    await this.obtenerPorId(id, usuario); // 404 / sin acceso
    return measurementService.listarCanalPorId(id, filtro);
  },
};
