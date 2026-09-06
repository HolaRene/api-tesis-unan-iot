/**
 * Tipos del módulo de actuadores.
 */

export interface Actuador {
  id: string;
  dispositivo_id: string;
  nombre: string;
  codigo: string;
  tipo: string;
  estado_actual: string | null;
  activo: boolean;
  configuracion: Record<string, unknown> | null;
  creado_en: Date;
}

/**
 * Actuador con datos relacionados legibles (JOIN): dispositivo y área.
 */
export interface ActuadorConRelaciones extends Actuador {
  dispositivo_nombre: string | null;
  area_id: string | null;
  area_nombre: string | null;
}

/** Datos de entrada para crear un actuador. */
export interface CrearActuadorInput {
  dispositivo_id: string;
  nombre: string;
  codigo: string;
  tipo: string;
  estado_actual?: string | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}

/** Campos actualizables de un actuador. */
export interface ActualizarActuadorInput {
  dispositivo_id?: string;
  nombre?: string;
  codigo?: string;
  tipo?: string;
  estado_actual?: string | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}
