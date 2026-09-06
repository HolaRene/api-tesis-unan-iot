import { query } from '../../database/pool.js';
import type {
  ClaveApi,
  ClaveApiSegura,
  PermisosClaveApi,
} from './clave-api.types.js';

/** Columnas internas de la tabla claves_api. */
const CAMPOS_CLAVE = `
  id, usuario_id, nombre, prefijo, hash_clave, activa, permisos,
  ultimo_uso, expira_en, creado_en`;

/**
 * Helper: convierte una fila ClaveApi a su versión pública (sin hash).
 */
function aSegura(fila: ClaveApi): ClaveApiSegura {
  const { hash_clave: _hash, ...segura } = fila;
  return segura as ClaveApiSegura;
}

/**
 * Repositorio de API Keys. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio: nunca recibe claves en texto plano aquí,
 * solo el hash y el prefijo que ya calcula el servicio.
 */
export const claveApiRepository = {
  /** Lista las claves de un usuario (sin hash). */
  async listarPorUsuario(usuarioId: string): Promise<ClaveApiSegura[]> {
    const resultado = await query<ClaveApi>(
      `SELECT ${CAMPOS_CLAVE} FROM claves_api WHERE usuario_id = $1 ORDER BY creado_en DESC`,
      [usuarioId]
    );
    return resultado.rows.map(aSegura);
  },

  /**
   * Crea una clave. `prefijo`, `hashClave` y `permisos` ya vienen preparados.
   */
  async crear(datos: {
    usuario_id: string;
    nombre: string;
    prefijo: string;
    hash_clave: string;
    activa?: boolean;
    permisos?: PermisosClaveApi;
    expira_en?: Date | null;
  }): Promise<ClaveApiSegura> {
    const fila = await query<ClaveApi>(
      `INSERT INTO claves_api
         (usuario_id, nombre, prefijo, hash_clave, activa, permisos, expira_en)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $7)
       RETURNING ${CAMPOS_CLAVE}`,
      [
        datos.usuario_id,
        datos.nombre,
        datos.prefijo,
        datos.hash_clave,
        datos.activa ?? null,
        datos.permisos ? JSON.stringify(datos.permisos) : JSON.stringify({}),
        datos.expira_en ?? null,
      ]
    );
    return aSegura(fila.rows[0]);
  },

  /**
   * Localiza una clave por prefijo (parte visible). Retorna fila con hash
   * para poder validar. Se usa en el middleware de API Key.
   */
  async buscarPorPrefijo(prefijo: string): Promise<ClaveApi | null> {
    const resultado = await query<ClaveApi>(
      `SELECT ${CAMPOS_CLAVE} FROM claves_api WHERE prefijo = $1 LIMIT 1`,
      [prefijo]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Devuelve una clave (con hash) perteneciente a un usuario y id dado.
   * Permite al usuario revocar o verificar la propiedad de SU clave.
   */
  async buscarPropia(usuarioId: string, id: string): Promise<ClaveApi | null> {
    const resultado = await query<ClaveApi>(
      `SELECT ${CAMPOS_CLAVE} FROM claves_api
       WHERE id = $1 AND usuario_id = $2 LIMIT 1`,
      [id, usuarioId]
    );
    return resultado.rows[0] ?? null;
  },

  /** Revoca (desactiva) una clave propia del usuario. */
  async revocar(usuarioId: string, id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      `UPDATE claves_api SET activa = FALSE
       WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, usuarioId]
    );
    return (resultado.rowCount ?? 0) > 0;
  },

  /**
   * Actualiza el último uso de la clave (la validación automática lo llama).
   */
  async actualizarUltimoUso(id: string): Promise<void> {
    await query(`UPDATE claves_api SET ultimo_uso = NOW() WHERE id = $1`, [id]);
  },
};
