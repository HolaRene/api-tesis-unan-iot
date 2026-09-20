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

/**
 * Intervalos de agrupación temporal admitidos para las series agregadas.
 * Se validan contra esta lista (lista blanca) antes de tocar el SQL.
 */
export const INTERVALOS_AGREGACION = [
  'minuto',
  'hora',
  'dia',
  'semana',
  'mes',
] as const;

export type IntervaloAgregacion = (typeof INTERVALOS_AGREGACION)[number];

/** Un cubo temporal con las estadísticas de las mediciones que contiene. */
export interface SerieAgregada {
  /** Inicio del intervalo (lo devuelve `date_trunc`). */
  cubo: Date;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  /** Desviación estándar muestral (null si solo hay 1 muestra). */
  desviacion: number | null;
  /** Número de mediciones dentro del cubo. */
  muestras: number;
}

/** Respuesta del endpoint de series: los cubos + un resumen global. */
export interface SeriesAgregadas {
  intervalo: IntervaloAgregacion;
  desde: string | null;
  hasta: string | null;
  /** Totales del periodo completo (no la media de las medias). */
  resumen: {
    media: number | null;
    minimo: number | null;
    maximo: number | null;
    muestras: number;
  };
  series: SerieAgregada[];
}

