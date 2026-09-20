import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarSensorInput,
  CrearSensorInput,
  SensorConNombres,
} from './sensor.types.js';
import { sensorRepository } from './sensor.repository.js';
import { canalService } from '../canales/canal.service.js';
import { condicionVisibilidad, type UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del módulo de sensores.
 *
 * AISLAMIENTO: el sensor hereda la propiedad de su dispositivo. Las
 * operaciones de la API reciben el usuario; las internas (IoT) no.
 */
export const sensorService = {
  /**
   * Lista los sensores visibles para el usuario (con filtros opcionales).
   * El sensor hereda la propiedad de su dispositivo.
   */
  async listar(
    filtro?: {
      area_id?: string;
      dispositivo_id?: string;
      tipo_variable_id?: string;
      activo?: boolean;
      buscar?: string;
    },
    usuario?: UsuarioAlcance | null
  ): Promise<SensorConNombres[]> {
    return sensorRepository.listar(filtro, usuario);
  },

  /**
   * Obtiene un sensor por id (solo si es visible para el usuario).
   * 404 si no existe o no tiene acceso.
   */
  async obtenerPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<SensorConNombres> {
    const sensor = await sensorRepository.buscarPorId(id, usuario);
    if (!sensor) {
      throw ApiError.notFound('Sensor no encontrado');
    }
    return sensor;
  },

  /**
   * Crea un sensor. Valida referencias y unicidad del código.
   * El dispositivo destino debe ser accesible para el usuario.
   */
  async crear(
    entrada: CrearSensorInput,
    usuario?: UsuarioAlcance | null
  ): Promise<SensorConNombres> {
    await this.validarExistencias(
      entrada.dispositivo_id,
      entrada.tipo_variable_id,
      usuario
    );

    // Valida que los tipos de variable de cada magnitud declarada existan.
    for (const magnitud of entrada.canales ?? []) {
      await this.validarExistencias(null, magnitud.tipo_variable_id);
    }

    const existente = await sensorRepository.buscarPorCodigo(entrada.codigo);
    if (existente) {
      throw ApiError.conflict('Ya existe un sensor con ese código');
    }

    const sensor = await sensorRepository.crear(entrada);

    // Modelo multivariable: el sensor declara sus magnitudes (`canales`) y se
    // crea un canal por cada una. Si no se declaran, se usa la magnitud
    // principal. Un fallo aquí no debe impedir el alta del sensor.
    try {
      await canalService.crearCanalesDeSensor({
        id: sensor.id,
        codigo: sensor.codigo,
        nombre: sensor.nombre,
        tipo_variable_id: sensor.tipo_variable_id,
        unidad: sensor.unidad ?? sensor.tipo_unidad ?? null,
        rango_min: sensor.rango_min,
        rango_max: sensor.rango_max,
        precision: sensor.precision,
        activo: sensor.activo,
        magnitudes: entrada.canales,
      });
    } catch (error) {
      console.warn(
        `[sensors] No se pudieron crear los canales del sensor ${sensor.codigo}:`,
        error instanceof Error ? error.message : error
      );
    }

    return sensor;
  },

  /**
   * Actualiza un sensor por id (solo si el usuario tiene acceso).
   */
  async actualizar(
    id: string,
    entrada: ActualizarSensorInput,
    usuario?: UsuarioAlcance | null
  ): Promise<SensorConNombres> {
    // Comprueba acceso antes de nada (404 si no es visible).
    await this.obtenerPorId(id, usuario);

    if (entrada.codigo !== undefined) {
      const existente = await sensorRepository.buscarPorCodigo(entrada.codigo);
      if (existente && existente.id !== id) {
        throw ApiError.conflict('Ya existe otro sensor con ese código');
      }
    }

    await this.validarExistencias(
      entrada.dispositivo_id,
      entrada.tipo_variable_id,
      usuario
    );

    const actualizado = await sensorRepository.actualizar(id, entrada, usuario);
    if (!actualizado) {
      throw ApiError.forbidden('No tiene permisos para modificar este sensor');
    }

    // Valida las magnitudes nuevas y mantiene los canales alineados (best-effort).
    for (const magnitud of entrada.canales ?? []) {
      await this.validarExistencias(null, magnitud.tipo_variable_id);
    }

    try {
      await canalService.sincronizarDesdeSensor({
        id: actualizado.id,
        codigo: actualizado.codigo,
        nombre: actualizado.nombre,
        tipo_variable_id: actualizado.tipo_variable_id,
        unidad: actualizado.unidad ?? actualizado.tipo_unidad ?? null,
        rango_min: actualizado.rango_min,
        rango_max: actualizado.rango_max,
        precision: actualizado.precision,
        activo: actualizado.activo,
        magnitudes: entrada.canales,
      });
    } catch (error) {
      console.warn(
        `[sensors] No se pudieron sincronizar los canales del sensor ${actualizado.codigo}:`,
        error instanceof Error ? error.message : error
      );
    }

    return actualizado;
  },

  /**
   * Elimina un sensor por id (solo si el usuario tiene acceso).
   */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const eliminado = await sensorRepository.eliminar(id, usuario);
    if (!eliminado) {
      const existe = await sensorRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para eliminar este sensor');
      }
      throw ApiError.notFound('Sensor no encontrado');
    }
  },

  /**
   * Valida que el dispositivo y el tipo de variable existan.
   *
   * Si se pasa `usuario`, el dispositivo debe ser además accesible: evita que
   * un usuario cuelgue sus sensores de un dispositivo ajeno.
   */
  async validarExistencias(
    dispositivoId?: string | null,
    tipoVariableId?: string | null,
    usuario?: UsuarioAlcance | null
  ): Promise<void> {
    if (dispositivoId) {
      const cond = condicionVisibilidad('d', 2, usuario);
      const where = cond ? `AND ${cond.sql}` : '';
      const valores = cond ? [dispositivoId, cond.valor] : [dispositivoId];

      const dispositivo = await query<{ id: string }>(
        `SELECT id FROM dispositivos d WHERE d.id = $1 ${where} LIMIT 1`,
        valores
      );
      if (dispositivo.rows.length === 0) {
        throw ApiError.badRequest(
          `El dispositivo con id ${dispositivoId} no existe o no tiene acceso a él`
        );
      }
    }
    if (tipoVariableId) {
      const tipo = await query<{ id: string }>(
        'SELECT id FROM tipos_variable WHERE id = $1 LIMIT 1',
        [tipoVariableId]
      );
      if (tipo.rows.length === 0) {
        throw ApiError.badRequest(`El tipo de variable con id ${tipoVariableId} no existe`);
      }
    }
  },
};
