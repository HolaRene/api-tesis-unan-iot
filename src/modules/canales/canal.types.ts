/** Tipos del módulo Canales (magnitud concreta de un sensor físico). */

export interface Canal {
  id: string;
  sensor_id: string | null;
  tipo_variable_id: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  unidad: string | null;
  rango_min: number | null;
  rango_max: number | null;
  precision_valor: number | null;
  activo: boolean;
  configuracion: Record<string, unknown>;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FilaCanalDetalle {
  // base
  id: string;
  sensor_id: string | null;
  tipo_variable_id: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  unidad: string | null;
  rango_min: number | null;
  rango_max: number | null;
  precision_valor: number | null;
  activo: boolean;
  // relaciones
  dispositivo_id?: string | null;
  dispositivo_nombre?: string | null;
  dispositivo_identificador?: string | null;
  area_nombre?: string | null;
  area_tipo?: string | null;
  tipo_nombre?: string | null;
  tipo_codigo?: string | null;
  tipo_dato?: string | null;
  tipo_unidad?: string | null;
  categoria?: string | null;
  permite_reglas?: boolean;
  // última medición
  ultima_medicion_id?: number | null;
  ultimo_valor_numerico?: number | null;
  ultimo_valor_texto?: string | null;
  ultimo_valor_booleano?: boolean | null;
  ultimo_registrado_en?: string | null;
  cantidad_mediciones?: number | null;
  alerta_activa?: boolean;
}

/** Entrada para crear un canal. */
export interface CrearCanalInput {
  sensor_id?: string | null;
  tipo_variable_id?: string | null;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  unidad?: string | null;
  rango_min?: number | null;
  rango_max?: number | null;
  precision_valor?: number | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}

export interface ActualizarCanalInput {
  sensor_id?: string | null;
  tipo_variable_id?: string | null;
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  unidad?: string | null;
  rango_min?: number | null;
  rango_max?: number | null;
  precision_valor?: number | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}

export interface FiltroCanales {
  sensor_id?: string;
  dispositivo_id?: string;
  area_id?: string;
  tipo_variable_id?: string;
  activo?: boolean;
  buscar?: string;
}
