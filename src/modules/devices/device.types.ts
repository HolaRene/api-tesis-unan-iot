/**
 * Tipos del módulo de dispositivos.
 */

/**
 * Representa un dispositivo tal como se almacena en la tabla `dispositivos`.
 * Los nombres de propiedades coinciden con las columnas (en español).
 */
export interface Device {
  id: string;
  area_id: string | null;
  nombre: string;
  tipo: string;
  fabricante: string | null;
  modelo: string | null;
  identificador: string | null;
  protocolo: string | null;
  direccion_ip: string | null;
  estado: string;
  metadatos: Record<string, unknown> | null;
  ultima_conexion: Date | null;
  /** Dueño del recurso. `null` = global (visible por todos, editable por admin). */
  propietario_id?: string | null;
  creado_en: Date;
}

/** Datos de entrada para crear un dispositivo. */
export interface CrearDeviceInput {
  area_id?: string | null;
  nombre: string;
  tipo: string;
  fabricante?: string | null;
  modelo?: string | null;
  identificador?: string | null;
  protocolo?: string | null;
  direccion_ip?: string | null;
  estado?: string;
  metadatos?: Record<string, unknown>;
  /** Lo asigna el servicio desde el usuario autenticado. */
  propietario_id?: string | null;
}

/** Campos actualizables de un dispositivo. */
export interface ActualizarDeviceInput {
  area_id?: string | null;
  nombre?: string;
  tipo?: string;
  fabricante?: string | null;
  modelo?: string | null;
  identificador?: string | null;
  protocolo?: string | null;
  direccion_ip?: string | null;
  estado?: string;
  metadatos?: Record<string, unknown>;
  ultima_conexion?: Date;
}
