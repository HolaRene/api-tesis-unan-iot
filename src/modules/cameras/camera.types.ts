/**
 * Tipos del módulo de cámaras.
 */

export interface Camera {
  id: string;
  dispositivo_id: string | null;
  protocolo: string | null;
  ruta_stream: string | null;
  grabacion_habilitada: boolean;
  configuracion: Record<string, unknown> | null;
}

export interface CrearCameraInput {
  dispositivo_id?: string | null;
  protocolo?: string | null;
  ruta_stream?: string | null;
  grabacion_habilitada?: boolean;
  configuracion?: Record<string, unknown>;
}

export interface ActualizarCameraInput {
  dispositivo_id?: string | null;
  protocolo?: string | null;
  ruta_stream?: string | null;
  grabacion_habilitada?: boolean;
  configuracion?: Record<string, unknown>;
}
