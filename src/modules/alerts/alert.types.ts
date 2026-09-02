/**
 * Tipos del módulo de alertas.
 */

/** Estado posible de una alerta. */
export type EstadoAlerta = 'active' | 'acknowledged' | 'resolved';

/**
 * Representa una alerta tal como se almacena en la tabla `alertas`.
 */
export interface Alert {
  id: string;
  sensor_id: string | null;
  medicion_id: number | null;
  tipo: string | null;
  severidad: string | null;
  mensaje: string | null;
  estado: string;
  iniciada_en: Date;
  reconocida_en: Date | null;
  finalizada_en: Date | null;
  metadatos: Record<string, unknown> | null;
}

/** Datos de entrada para crear una alerta. */
export interface CrearAlertInput {
  sensor_id?: string | null;
  medicion_id?: number | null;
  tipo?: string | null;
  severidad?: string | null;
  mensaje?: string | null;
  estado?: string;
  reconocida_en?: Date | null;
  finalizada_en?: Date | null;
  metadatos?: Record<string, unknown>;
}

/** Campos actualizables de una alerta. */
export interface ActualizarAlertInput {
  sensor_id?: string | null;
  medicion_id?: number | null;
  tipo?: string | null;
  severidad?: string | null;
  mensaje?: string | null;
  estado?: string;
  reconocida_en?: Date | null;
  finalizada_en?: Date | null;
  metadatos?: Record<string, unknown>;
}
