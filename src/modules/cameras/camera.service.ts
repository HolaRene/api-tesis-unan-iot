import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarCamaraInput,
  CamaraDetalle,
  CrearCamaraInput,
  EstadoCamara,
  FiltrarCamaras,
} from './camera.types.js';
import { camaraRepository } from './camera.repository.js';
import { condicionVisibilidad, type UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del módulo de cámaras IP.
 *
 * AISLAMIENTO: igual que el resto de entidades, las operaciones de la API
 * reciben el usuario autenticado (admin ve todo; el resto, solo lo suyo).
 *
 * ALCANCE: la API **administra** la cámara (metadatos y configuración).
 * NO transporta vídeo ni se conecta a RTSP: eso es responsabilidad de
 * MediaMTX.
 */
export const camaraService = {
  /** Lista las cámaras visibles para el usuario. */
  async listar(
    filtro: FiltrarCamaras = {},
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle[]> {
    return camaraRepository.listar(filtro, usuario);
  },

  /**
   * Obtiene una cámara por id.
   * 404 si no existe o no es visible (no revela existencia).
   */
  async obtenerPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle> {
    const camara = await camaraRepository.buscarPorId(id, usuario);
    if (!camara) throw ApiError.notFound('Cámara no encontrada');
    return camara;
  },

  /**
   * Crea una cámara validando que el área y el dispositivo (si se indican)
   * existan y sean accesibles para el usuario.
   */
  async crear(
    entrada: CrearCamaraInput,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle> {
    await this.validarRelaciones(
      entrada.area_id,
      entrada.dispositivo_id,
      usuario
    );
    await this.verificarRutaWebrtcUnica(entrada.ruta_webrtc);

    return camaraRepository.crear({
      ...entrada,
      // El propietario lo fija el servidor, nunca el cliente.
      propietario_id: usuario?.id ?? null,
    });
  },

  /** Actualiza una cámara (solo el propietario o un admin). */
  async actualizar(
    id: string,
    entrada: ActualizarCamaraInput,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle> {
    // Comprueba acceso antes de nada (404 si no es visible).
    await this.obtenerPorId(id, usuario);

    await this.validarRelaciones(
      entrada.area_id,
      entrada.dispositivo_id,
      usuario
    );
    if (entrada.ruta_webrtc !== undefined) {
      await this.verificarRutaWebrtcUnica(entrada.ruta_webrtc, id);
    }

    const actualizada = await camaraRepository.actualizar(id, entrada, usuario);
    if (!actualizada) {
      throw ApiError.forbidden('No tiene permisos para modificar esta cámara');
    }
    return actualizada;
  },

  /**
   * Cambia SOLO el estado de la cámara.
   *
   * Endpoint pensado para pruebas y para la futura integración con MediaMTX
   * (que reportará conectada/desconectada/error).
   */
  async actualizarEstado(
    id: string,
    estado: EstadoCamara,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle> {
    await this.obtenerPorId(id, usuario);

    const actualizada = await camaraRepository.actualizarEstado(
      id,
      estado,
      usuario
    );
    if (!actualizada) {
      throw ApiError.forbidden(
        'No tiene permisos para cambiar el estado de esta cámara'
      );
    }
    return actualizada;
  },

  /** Elimina una cámara (solo el propietario o un admin). */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const eliminada = await camaraRepository.eliminar(id, usuario);
    if (!eliminada) {
      const existe = await camaraRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para eliminar esta cámara');
      }
      throw ApiError.notFound('Cámara no encontrada');
    }
  },

  /**
   * Valida que el área y el dispositivo referenciados existan Y sean
   * accesibles para el usuario. Evita que se cuele una cámara en un árbol
   * ajeno (mismo criterio que dispositivos y sensores).
   */
  async validarRelaciones(
    areaId?: string | null,
    dispositivoId?: string | null,
    usuario?: UsuarioAlcance | null
  ): Promise<void> {
    if (areaId) {
      const cond = condicionVisibilidad('a', 2, usuario);
      const where = cond ? `AND ${cond.sql}` : '';
      const valores = cond ? [areaId, cond.valor] : [areaId];
      const r = await query<{ id: string }>(
        `SELECT id FROM areas a WHERE a.id = $1 ${where} LIMIT 1`,
        valores
      );
      if (r.rows.length === 0) {
        throw ApiError.badRequest(
          `El área con id ${areaId} no existe o no tiene acceso a ella`
        );
      }
    }

    if (dispositivoId) {
      const cond = condicionVisibilidad('d', 2, usuario);
      const where = cond ? `AND ${cond.sql}` : '';
      const valores = cond ? [dispositivoId, cond.valor] : [dispositivoId];
      const r = await query<{ id: string }>(
        `SELECT id FROM dispositivos d WHERE d.id = $1 ${where} LIMIT 1`,
        valores
      );
      if (r.rows.length === 0) {
        throw ApiError.badRequest(
          `El dispositivo con id ${dispositivoId} no existe o no tiene acceso a él`
        );
      }
    }
  },

  /**
   * La ruta WebRTC es única: dos cámaras con la misma ruta colisionarían
   * en MediaMTX. `excluirId` permite ignorar la propia cámara al editar.
   */
  async verificarRutaWebrtcUnica(
    rutaWebrtc?: string | null,
    excluirId?: string
  ): Promise<void> {
    if (!rutaWebrtc) return;
    const existente = await camaraRepository.buscarPorRutaWebrtc(rutaWebrtc);
    if (existente && existente.id !== excluirId) {
      throw ApiError.conflict(
        `Ya existe una cámara con la ruta WebRTC '${rutaWebrtc}'`
      );
    }
  },
};
