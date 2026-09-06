import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/api-error.js';
import type {
  ClaveApi,
  ClaveApiCreada,
  ClaveApiSegura,
  CrearClaveApiInput,
  PermisosClaveApi,
  IntegracionApiKey,
} from './clave-api.types.js';
import { claveApiRepository } from './clave-api.repository.js';

/** Prefijo corto y legible para las claves generadas. */
export const PREFIJO_CLAVE = 'flx_';

/**
 * Lógica de negocio del módulo de API Keys.
 * - Genera una clave aleatoria segura.
 * - Guarda SOLO el hash (bcrypt) y un prefijo visible.
 * - La clave completa se retorna una única vez (en `claveCompleta`).
 */
export const claveApiService = {
  /** Lista las claves seguras de un usuario. */
  async listarDeUsuario(usuarioId: string): Promise<ClaveApiSegura[]> {
    return claveApiRepository.listarPorUsuario(usuarioId);
  },

  /**
   * Crea una API Key. Devuelve la clave segura + la clave completa (una vez).
   */
  async crear(entrada: CrearClaveApiInput): Promise<ClaveApiCreada> {
    // Genera la parte secreta (ej: flx_ + 28 chars base64url)
    const secreto = crypto.randomBytes(21).toString('base64url'); // ~28 chars
    const claveCompleta = `${PREFIJO_CLAVE}${secreto}`;

    // Prefijo visible corto para identificar: flx_<primeros8>
    const prefijo = `${PREFIJO_CLAVE}${secreto.slice(0, 8)}`;
    const hashClave = await bcrypt.hash(claveCompleta, 10);

    const clave = await claveApiRepository.crear({
      usuario_id: entrada.usuario_id,
      nombre: entrada.nombre,
      prefijo,
      hash_clave: hashClave,
      permisos: entrada.permisos ?? {},
      expira_en: entrada.expira_en ?? null,
    });

    return {
      clave,
      claveCompleta,
      prefijo,
    };
  },

  /** Revoca (desactiva) una clave propia del usuario. */
  async revocar(usuarioId: string, id: string): Promise<void> {
    const revocada = await claveApiRepository.revocar(usuarioId, id);
    if (!revocada) {
      throw ApiError.notFound('API Key no encontrada o no pertenece al usuario');
    }
  },

  /**
   * Verifica una clave presentada (formato `flx_...`) contra el hash guardado.
   * Devuelve la estructura lista para `req.claveApi`, o null si es inválida.
   */
  async verificarClaveEnTexto(claveEnTexto: string): Promise<IntegracionApiKey | null> {
    // Nosotros generamos flx_<secreto>; el prefijo guardado es flx_<primeros 8>.
    if (!claveEnTexto.startsWith(PREFIJO_CLAVE) || claveEnTexto.length < PREFIJO_CLAVE.length + 8) {
      return null;
    }

    // El prefijo visible guardado son los primeros 8 caracteres de la parte secreta.
    const secretoParcial = claveEnTexto.slice(PREFIJO_CLAVE.length);
    const prefijo = `${PREFIJO_CLAVE}${secretoParcial.slice(0, 8)}`;

    const fila: ClaveApi | null = await claveApiRepository.buscarPorPrefijo(prefijo);
    if (!fila) {
      return null;
    }

    const valida = await bcrypt.compare(claveEnTexto, fila.hash_clave);
    if (!valida) {
      return null;
    }

    if (!fila.activa) {
      return null;
    }

    if (fila.expira_en && fila.expira_en.getTime() < Date.now()) {
      return null;
    }

    const permisos = (fila.permisos ?? {}) as PermisosClaveApi;
    // Actualiza último uso (no bloquea la petición si falla la escritura).
    void claveApiRepository.actualizarUltimoUso(fila.id);

    return {
      claveApiId: fila.id,
      usuarioId: fila.usuario_id,
      claveApiNombre: fila.nombre,
      permisos: permisos ?? {},
    };
  },

  /**
   * Marca una clave como usada (para no olvidar la escritura cuando se logre).
   * En la práctica el repo actualiza el último_uso.
   */
  async notificarUso(id: string): Promise<void> {
    await claveApiRepository.actualizarUltimoUso(id);
  },
};
