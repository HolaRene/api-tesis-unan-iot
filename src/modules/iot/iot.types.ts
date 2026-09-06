/**
 * Tipos del módulo IoT (rutas de integración autenticadas por API Key).
 */

/** Un sensor y su valor dentro del payload de ingesta. */
export interface MedicionEntrada {
  sensor: string; // código o identificador lógico, ej: TEMP-Q2
  valor: number | string | boolean | Record<string, unknown> | null;
}

/**
 * Payload que una integración (Node-RED) envía a POST /api/v1/iot/mediciones.
 * No usa UUIDs internos: usa identificadores/códigos lógicos.
 */
export interface IngestaMedicionesEntrada {
  dispositivo: string; // identificador del dispositivo, ej: ESP32-Q2
  mediciones: MedicionEntrada[];
  metadatos?: Record<string, unknown>;
}

/**
 * Resultado de la ingesta: cuántas mediciones se procesaron y lista de ids.
 */
export interface ResultadoIngesta {
  proceso: string;
  procesadas: number;
  fallidas: number;
  mediciones: unknown[];
}

/**
 * Payload para enviar un comando a un actuador desde una integración.
 */
export interface ComandoIntegracionEntrada {
  actuador: string; // código del actuador, ej: BUZZER-Q2
  comando: string; // activar / desactivar / ...
  valor?: Record<string, unknown> | boolean | number | string;
  metadatos?: Record<string, unknown>;
}
