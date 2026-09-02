/**
 * Tipos del módulo de umbrales.
 */

/**
 * Representa un umbral tal como se almacena en la tabla `umbrales`.
 * Los valores numéricos se devuelven como string por precisión NUMERIC.
 */
export interface Threshold {
  id: string;
  sensor_id: string | null;
  valor_min: string | null;
  valor_max: string | null;
  severidad: string | null;
  activo: boolean;
  creado_en: Date;
}

/** Datos de entrada para crear un umbral. */
export interface CrearThresholdInput {
  sensor_id?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  severidad?: string | null;
  activo?: boolean;
}

/** Campos actualizables de un umbral. */
export interface ActualizarThresholdInput {
  sensor_id?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  severidad?: string | null;
  activo?: boolean;
}
