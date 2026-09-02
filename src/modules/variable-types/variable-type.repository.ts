import { query } from '../../database/pool.js';
import type {
  ActualizarVariableTypeInput,
  CrearVariableTypeInput,
  VariableType,
} from './variable-type.types.js';

/** Columnas devueltas en las consultas que mapean a un Tipo de Variable. */
const CAMPOS_TIPO = 'id, codigo, nombre, descripcion, tipo_dato, unidad_default';

/**
 * Repositorio de tipos de variable. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const variableTypeRepository = {
  /**
   * Lista todos los tipos de variable.
   */
  async listar(): Promise<VariableType[]> {
    const resultado = await query<VariableType>(
      `SELECT ${CAMPOS_TIPO} FROM tipos_variable ORDER BY nombre`
    );
    return resultado.rows;
  },

  /**
   * Busca un tipo de variable por id.
   */
  async buscarPorId(id: string): Promise<VariableType | null> {
    const resultado = await query<VariableType>(
      `SELECT ${CAMPOS_TIPO} FROM tipos_variable WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Busca un tipo de variable por su código (columna única).
   */
  async buscarPorCodigo(codigo: string): Promise<VariableType | null> {
    const resultado = await query<VariableType>(
      `SELECT ${CAMPOS_TIPO} FROM tipos_variable WHERE codigo = $1 LIMIT 1`,
      [codigo]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un tipo de variable y devuelve el registro creado.
   */
  async crear(datos: CrearVariableTypeInput): Promise<VariableType> {
    const resultado = await query<VariableType>(
      `INSERT INTO tipos_variable (codigo, nombre, descripcion, tipo_dato, unidad_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CAMPOS_TIPO}`,
      [datos.codigo, datos.nombre, datos.descripcion ?? null, datos.tipo_dato, datos.unidad_default ?? null]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un tipo de variable por id. Construye los SET según los campos.
   */
  async actualizar(id: string, datos: ActualizarVariableTypeInput): Promise<VariableType | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    const agregar = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(valor);
    };

    if (datos.codigo !== undefined) agregar('codigo', datos.codigo);
    if (datos.nombre !== undefined) agregar('nombre', datos.nombre);
    if (datos.descripcion !== undefined) agregar('descripcion', datos.descripcion);
    if (datos.tipo_dato !== undefined) agregar('tipo_dato', datos.tipo_dato);
    if (datos.unidad_default !== undefined) agregar('unidad_default', datos.unidad_default);

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<VariableType>(
      `UPDATE tipos_variable SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_TIPO}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un tipo de variable por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM tipos_variable WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
