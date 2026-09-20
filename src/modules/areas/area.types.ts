/**
 * Tipos del módulo de áreas.
 */

/**
 * Representa un área tal como se almacena en la tabla `areas`.
 * Los nombres de propiedades coinciden con las columnas (en español).
 */
export interface Area {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  activo: boolean;
  /** Dueño del recurso. `null` = global (visible por todos, editable por admin). */
  propietario_id?: string | null;
  creado_en: Date;
}

/** Datos de entrada para crear un área. */
export interface CrearAreaInput {
  nombre: string;
  tipo?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  activo?: boolean;
  /** Lo asigna el servicio desde el usuario autenticado. */
  propietario_id?: string | null;
}

/** Campos actualizables de un área. */
export interface ActualizarAreaInput {
  nombre?: string;
  tipo?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  activo?: boolean;
}
