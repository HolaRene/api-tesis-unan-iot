/** Tipos del módulo Reglas de Alerta (condición sobre un canal). */

export interface ReglaAlerta {
  id: string;
  canal_id: string;
  nombre: string;
  descripcion: string | null;
  operador: string;
  valor_referencia_numerico: number | null;
  valor_referencia_texto: string | null;
  valor_referencia_booleano: boolean | null;
  valor_min: number | null;
  valor_max: number | null;
  severidad: 'info' | 'warning' | 'critical';
  mensaje: string | null;
  activa: boolean;
  retardo_segundos: number | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FilaReglaDetalle {
  // regla
  id: string;
  canal_id: string;
  nombre: string;
  descripcion: string | null;
  operador: string;
  valor_referencia_numerico: number | null;
  valor_referencia_texto: string | null;
  valor_referencia_booleano: boolean | null;
  valor_min: number | null;
  valor_max: number | null;
  severidad: 'info' | 'warning' | 'critical';
  mensaje: string | null;
  activa: boolean;
  retardo_segundos: number | null;
  // relaciones
  canal_codigo?: string | null;
  canal_nombre?: string | null;
  canal_unidad?: string | null;
  tipo_nombre?: string | null;
  tipo_dato?: string | null;
  dispositivo_nombre?: string | null;
  dispositivo_identificador?: string | null;
  area_nombre?: string | null;
}

export interface CrearReglaInput {
  canal_id: string;
  nombre: string;
  descripcion?: string | null;
  operador: string;
  valor_referencia_numerico?: number | null;
  valor_referencia_texto?: string | null;
  valor_referencia_booleano?: boolean | null;
  valor_min?: number | null;
  valor_max?: number | null;
  severidad: 'info' | 'warning' | 'critical';
  mensaje?: string | null;
  activa?: boolean;
  retardo_segundos?: number | null;
}

export interface ActualizarReglaInput {
  canal_id?: string;
  nombre?: string;
  descripcion?: string | null;
  operador?: string;
  valor_referencia_numerico?: number | null;
  valor_referencia_texto?: string | null;
  valor_referencia_booleano?: boolean | null;
  valor_min?: number | null;
  valor_max?: number | null;
  severidad?: 'info' | 'warning' | 'critical';
  mensaje?: string | null;
  activa?: boolean;
  retardo_segundos?: number | null;
}

export interface FiltroReglas {
  canal_id?: string;
  dispositivo_id?: string;
  activa?: boolean;
}
