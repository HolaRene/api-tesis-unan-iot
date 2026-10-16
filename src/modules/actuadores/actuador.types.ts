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
  /** Cómo se acciona: `modbus`, `gpio`, `mqtt` o `http`. */
  protocolo: string;
  /** Direccionamiento según el protocolo (dirección Modbus, pin GPIO…). */
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
  /**
   * Código del actuador.
   *
   * Opcional: lo genera el servidor a partir del tipo y el nombre. Si el
   * cliente lo envía, el servicio lo ignora y usa el suyo, para garantizar
   * que sea único y consistente.
   */
  codigo?: string;
  tipo: string;
  estado_actual?: string | null;
  activo?: boolean;
  /** Cómo se acciona: modbus, gpio, mqtt o http. */
  protocolo?: string;
  /** Direccionamiento según el protocolo. */
  configuracion?: Record<string, unknown> | null;
}

/** Campos actualizables de un actuador. */
export interface ActualizarActuadorInput {
  dispositivo_id?: string;
  nombre?: string;
  codigo?: string;
  tipo?: string;
  estado_actual?: string | null;
  activo?: boolean;
  protocolo?: string;
  configuracion?: Record<string, unknown> | null;
}
