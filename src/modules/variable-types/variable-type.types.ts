/**
 * Tipos del módulo de tipos de variable.
 */

/**
 * Representa un tipo de variable tal como se almacena en la tabla
 * `tipos_variable`. Los nombres de propiedades coinciden con las columnas.
 */
export interface VariableType {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo_dato: string;
  unidad_default: string | null;
}

/** Datos de entrada para crear un tipo de variable. */
export interface CrearVariableTypeInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipo_dato: string;
  unidad_default?: string | null;
}

/** Campos actualizables de un tipo de variable. */
export interface ActualizarVariableTypeInput {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  tipo_dato?: string;
  unidad_default?: string | null;
}
