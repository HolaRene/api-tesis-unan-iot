/**
 * Tipos del módulo de dashboard (resumen).
 */

export interface Totales {
  areas: number;
  dispositivos: number;
  sensores: number;
  mediciones: number;
  alertas_activas: number;
}

/** Una medición con la relación legible del sensor (id/código). */
export interface MedicionResumen {
  id: number;
  sensor_id: string;
  sensor_codigo: string | null;
  sensor_nombre: string | null;
  unidad: string | null;
  dispositivo_nombre: string | null;
  valor_numerico: number | null;
  valor_texto: string | null;
  calidad: string;
  registrado_en: Date;
}

/** Resumen completo devuelto por GET /api/v1/dashboard/resumen. */
export interface ResumenDashboard {
  totales: Totales;
  ultimas_mediciones: MedicionResumen[];
  dispositivos_recientes: unknown[];
  ultimas_alertas: unknown[];
}
