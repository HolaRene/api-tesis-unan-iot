/**
 * Tipos del módulo de mediciones.
 */

/**
 * Representa una medición tal como se almacena en la tabla `mediciones`.
 * Según el tipo de sensor, solo se usarán algunos de los campos de valor.
 */
export interface Measurement {
  id: number;
  sensor_id: string | null;
  canal_id?: string | null;
  valor_numerico: number | null;
  valor_texto: string | null;
  valor_booleano: boolean | null;
  valor_json: Record<string, unknown> | null;
  calidad: string;
  registrado_en: Date;
  metadatos: Record<string, unknown> | null;
}

/**
 * Datos de entrada para registrar (ingerir) una medición.
 * Puede recibir cualquiera de los tipos de valor; al validar se
 * garantizará que al menos uno esté presente.
 */
export interface CrearMeasurementInput {
  sensor_id?: string | null;
  canal_id?: string | null;
  valor_numerico?: number;
  valor_texto?: string;
  valor_booleano?: boolean;
  valor_json?: Record<string, unknown>;
  calidad?: string;
  registrado_en?: Date;
  metadatos?: Record<string, unknown>;
}

/** Parámetros de consulta para listar mediciones (global). */
export interface FiltrarMediciones {
  sensor_id?: string;
  canal_id?: string;
  dispositivo_id?: string;
  area_id?: string;
  tipo_variable_id?: string;
  desde?: string; // ISO fecha/hora para registrado_en >= 
  hasta?: string; // ISO fecha/hora para registrado_en <=
  limite?: number;
  /** true = orden ascendente (historial para gráfica), false/undefined = descendente */
  orden_ascendente?: boolean;
}
