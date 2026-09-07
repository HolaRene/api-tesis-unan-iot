/**
 * Tipos del módulo IoT (rutas de integración autenticadas por API Key).
 */

/** Un canal (o sensor, por compatibilidad) y su valor dentro del payload. */
export interface MedicionEntrada {
  /** Código del canal (preferido en el modelo multivariable). */
  canal?: string;
  /** Código del sensor (compatibilidad previa); se normaliza al canal del mismo código si existe. */
  sensor?: string;
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
