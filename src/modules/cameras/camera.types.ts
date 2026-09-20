/**
 * Tipos del módulo de cámaras IP.
 *
 * SEGURIDAD: el modelo NO almacena credenciales RTSP ni URLs con
 * credenciales. `ruta_stream` es únicamente el PATH del stream
 * (p. ej. `/stream1`); el usuario/contraseña, si existen, viven en la
 * configuración de MediaMTX, nunca aquí ni en el navegador.
 */

/** Estados posibles de una cámara. */
export const ESTADOS_CAMARA = [
  'activa',
  'inactiva',
  'conectada',
  'desconectada',
  'error',
] as const;

export type EstadoCamara = (typeof ESTADOS_CAMARA)[number];

/** Cámara tal como se almacena en la tabla `camaras`. */
export interface Camara {
  id: string;
  nombre: string;
  descripcion: string | null;
  area_id: string | null;
  dispositivo_id: string | null;
  direccion_ip: string | null;
  puerto_rtsp: number;
  protocolo: string;
  /** PATH del stream en la cámara (p. ej. `/stream1`). Nunca la URL completa. */
  ruta_stream: string;
  /** PATH del stream en MediaMTX (p. ej. `/camara-qui-1`). */
  ruta_webrtc: string | null;
  estado: EstadoCamara;
  activa: boolean;
  ultima_conexion: Date | null;
  grabacion_habilitada: boolean;
  metadatos: Record<string, unknown>;
  configuracion: Record<string, unknown> | null;
  propietario_id: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

/** Cámara con los nombres legibles de sus relaciones (para el listado). */
export interface CamaraDetalle extends Camara {
  area_nombre: string | null;
  dispositivo_nombre: string | null;
  dispositivo_identificador: string | null;
}

/** Datos de entrada para crear una cámara. */
export interface CrearCamaraInput {
  nombre: string;
  descripcion?: string | null;
  area_id?: string | null;
  dispositivo_id?: string | null;
  direccion_ip?: string | null;
  puerto_rtsp?: number;
  protocolo?: string;
  ruta_stream: string;
  ruta_webrtc?: string | null;
  estado?: EstadoCamara;
  activa?: boolean;
  grabacion_habilitada?: boolean;
  metadatos?: Record<string, unknown>;
  configuracion?: Record<string, unknown>;
  /** Lo asigna el servicio desde el usuario autenticado. */
  propietario_id?: string | null;
}

/** Campos actualizables de una cámara. */
export type ActualizarCamaraInput = Partial<
  Omit<CrearCamaraInput, 'propietario_id'>
>;

/** Filtros del listado. */
export interface FiltrarCamaras {
  area_id?: string;
  dispositivo_id?: string;
  estado?: EstadoCamara;
  activa?: boolean;
  buscar?: string;
}
