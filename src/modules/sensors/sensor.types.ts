/**
 * Tipos del módulo de sensores.
 */

/**
 * Representa un sensor tal como se almacena en la tabla `sensores`.
 * Los nombres de propiedades coinciden con las columnas (en español).
 */
export interface Sensor {
  id: string;
  dispositivo_id: string | null;
  tipo_variable_id: string | null;
  nombre: string;
  codigo: string;
  fabricante: string | null;
  modelo: string | null;
  unidad: string | null;
  rango_min: string | null;
  rango_max: string | null;
  precision: string | null;
  activo: boolean;
  configuracion: Record<string, unknown> | null;
  creado_en: Date;
}

/**
 * Sensor con datos relacionados "legibles" (JOIN) para mostrarse en un
 * frontend: en vez de solo UUIDs, devuelve nombres de área, dispositivo
 * y tipo de variable.
 */
export interface SensorConNombres extends Sensor {
  area_id: string | null;
  area_nombre: string | null;
  dispositivo_nombre: string | null;
  tipo_codigo: string | null;
  tipo_nombre: string | null;
  tipo_unidad: string | null;
}

/** Magnitud (canal) que puede declarar un sensor al crearse/editarse. */
export interface MagnitudSensorInput {
  tipo_variable_id: string;
  codigo?: string | null;
  nombre?: string | null;
  unidad?: string | null;
  rango_min?: number | null;
  rango_max?: number | null;
  precision_valor?: number | null;
  activo?: boolean;
}

/** Datos de entrada para crear un sensor. */
export interface CrearSensorInput {
  dispositivo_id?: string | null;
  tipo_variable_id?: string | null;
  nombre: string;
  codigo: string;
  fabricante?: string | null;
  modelo?: string | null;
  unidad?: string | null;
  rango_min?: number | null;
  rango_max?: number | null;
  precision?: number | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
  /** Varias magnitudes; si se omite se usa `tipo_variable_id`. */
  canales?: MagnitudSensorInput[];
}

/** Campos actualizables de un sensor. */
export interface ActualizarSensorInput {
  dispositivo_id?: string | null;
  tipo_variable_id?: string | null;
  nombre?: string;
  codigo?: string;
  fabricante?: string | null;
  modelo?: string | null;
  unidad?: string | null;
  rango_min?: number | null;
  rango_max?: number | null;
  precision?: number | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
  /** Si se envía, sincroniza las magnitudes (canales) del sensor. */
  canales?: MagnitudSensorInput[];
}
