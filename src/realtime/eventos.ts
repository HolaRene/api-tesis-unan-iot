/**
 * Eventos de tiempo real (WebSocket).
 *
 * Contrato único entre backend y frontend. Los eventos se emiten **siempre
 * después** de que PostgreSQL ha confirmado el cambio (COMMIT): la base de
 * datos es la fuente de verdad y el WebSocket solo notifica.
 *
 * Esta entrega implementa los eventos de **dispositivos**. Los eventos de
 * mediciones/canales/alertas se declaran en el tipo para que el contrato sea
 * estable, pero se implementarán en una segunda entrega.
 */

/** Todos los tipos de evento soportados por el canal realtime. */
export type TipoEventoTiempoReal =
  // --- Dispositivos (esta entrega) ---
  | 'dispositivo:actualizado'
  | 'dispositivo:online'
  | 'dispositivo:offline'
  // --- Mediciones y canales (pendiente, segunda entrega) ---
  | 'medicion:nueva'
  | 'canal:actualizado'
  // --- Alertas (pendiente, segunda entrega) ---
  | 'alerta:creada'
  | 'alerta:actualizada'
  | 'alerta:resuelta';

/** Sobre que viaja por el WebSocket: tipo de evento + payload + metadatos. */
export interface EventoTiempoReal<T = unknown> {
  /** Tipo de evento (el frontend hace `switch` sobre este campo). */
  tipo: TipoEventoTiempoReal;
  /** Datos del evento (ver payloads por tipo abajo). */
  datos: T;
  /** Momento de emisión en ISO 8601 (lo genera el servidor). */
  emitido_en: string;
}

/**
 * Payload de `dispositivo:actualizado`.
 * Se emite cuando cambia información relevante del dispositivo distinta de la
 * transición de estado: IP, metadatos (firmware, RSSI, uptime…), nombre, etc.
 */
export interface PayloadDispositivoActualizado {
  dispositivo_id: string;
  identificador: string | null;
  estado: string;
  ultima_conexion: string | null;
  direccion_ip: string | null;
  metadatos: Record<string, unknown>;
  /** Campos que cambiaron respecto al estado anterior (diagnóstico). */
  campos_cambiados?: string[];
}

/** Payload de `dispositivo:online` (solo transición offline → online). */
export interface PayloadDispositivoOnline {
  dispositivo_id: string;
  identificador: string | null;
  estado_anterior: string;
  estado: 'online';
  ultima_conexion: string | null;
}

/** Payload de `dispositivo:offline` (solo transición online → offline). */
export interface PayloadDispositivoOffline {
  dispositivo_id: string;
  identificador: string | null;
  estado: 'offline';
  ultima_conexion: string | null;
  /** Cuándo lo detectó el watchdog (ISO 8601). */
  detectado_en: string;
}

/** Mensaje que el cliente puede enviar al servidor (ping de aplicación). */
export interface MensajeCliente {
  tipo: 'ping' | 'suscribir';
  /** Canales/entidades a los que suscribirse (reservado para el futuro). */
  temas?: string[];
}
