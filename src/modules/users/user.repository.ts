import type { PoolClient } from 'pg';
import { query } from '../../database/pool.js';
import type {
  CrearUsuarioInput,
  Usuario,
} from './user.types.js';

/** Columnas devueltas en las consultas que mapean a un Usuario. */
const CAMPOS_USUARIO = 'id, nombre, email, hash_contra, rol, activo, creado_en';

/**
 * Campos de actualización que el repositorio entiende a nivel de BD.
 * El service convierte la contraseña en su hash antes de invocar.
 */
export interface ActualizarUsuarioDb {
  nombre?: string;
  email?: string;
  hashContra?: string;
  rol?: string;
  activo?: boolean;
}

/**
 * Repositorio de usuarios. Contiene únicamente consultas SQL/PostgreSQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const usuarioRepository = {
  /**
   * Inserta un nuevo usuario y devuelve el registro creado.
   */
  async crear(data: CrearUsuarioInput, hashContrasena: string): Promise<Usuario> {
    const resultado = await query<Usuario>(
      `INSERT INTO usuarios (nombre, email, hash_contra, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CAMPOS_USUARIO}`,
      [data.nombre, data.email, hashContrasena, data.rol ?? 'viewer']
    );
    return resultado.rows[0];
  },

  /**
   * Lista todos los usuarios.
   */
  async listar(): Promise<Usuario[]> {
    const resultado = await query<Usuario>(
      `SELECT ${CAMPOS_USUARIO} FROM usuarios ORDER BY creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un usuario por email.
   */
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const resultado = await query<Usuario>(
      `SELECT ${CAMPOS_USUARIO}
       FROM usuarios
       WHERE email = $1
       LIMIT 1`,
      [email]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Busca un usuario por id.
   */
  async buscarPorId(id: string): Promise<Usuario | null> {
    const resultado = await query<Usuario>(
      `SELECT ${CAMPOS_USUARIO}
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Actualiza un usuario por id con los campos proporcionados.
   * Construye dinámicamente los SET según los campos presentes.
   */
  async actualizar(id: string, datos: ActualizarUsuarioDb): Promise<Usuario | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    if (datos.nombre !== undefined) {
      sets.push(`nombre = $${indice++}`);
      valores.push(datos.nombre);
    }
    if (datos.email !== undefined) {
      sets.push(`email = $${indice++}`);
      valores.push(datos.email);
    }
    if (datos.hashContra !== undefined) {
      sets.push(`hash_contra = $${indice++}`);
      valores.push(datos.hashContra);
    }
    if (datos.rol !== undefined) {
      sets.push(`rol = $${indice++}`);
      valores.push(datos.rol);
    }
    if (datos.activo !== undefined) {
      sets.push(`activo = $${indice++}`);
      valores.push(datos.activo);
    }

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<Usuario>(
      `UPDATE usuarios SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_USUARIO}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un usuario por id.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },

  /**
   * Permite ejecutar una consulta dentro del contexto de una transacción
   * ya abierta. Se utiliza cuando una operación necesita SQL a nivel de
   * base de datos dentro del manejo transaccional del service.
   */
  async conTransaccion(client: PoolClient, sql: string, valores: unknown[]) {
    const resultado = await client.query(sql, valores);
    return resultado;
  },
};
