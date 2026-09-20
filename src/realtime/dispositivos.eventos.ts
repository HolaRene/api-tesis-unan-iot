/**
 * Emisores de eventos realtime de DISPOSITIVOS.
 *
 * Punto ÚNICO de emisión para los eventos de dispositivo. Ni los controladores,
 * ni los servicios, ni el watchdog deben llamar a `socket.send`/`emitirEvento`
 * por su cuenta: usan estas funciones, que además aplican las reglas
 * anti-ruido.
 *
 * Reglas anti-ruido:
 *   - `dispositivo:online`  → SOLO transición distinta-de-online → online.
 *   - `dispositivo:offline` → SOLO transición online → offline.
 *   - `dispositivo:actualizado` → solo si cambió algo relevante (IP, metadatos…),
 *     nunca en cada medición.
 *
 * IMPORTANTE: estas funciones deben llamarse **después** del COMMIT de
 * PostgreSQL.
 */
import type { Device } from '../modules/devices/device.types.js';
import { emitirEvento } from './websocket.servidor.js';
import type {
  PayloadDispositivoActualizado,
  PayloadDispositivoOffline,
  PayloadDispositivoOnline,
} from './eventos.js';

/** Campos que se consideran "relevantes" para `dispositivo:actualizado`. */
const CAMPOS_RELEVANTES: Array<keyof Device> = [
  'nombre',
  'tipo',
  'fabricante',
  'modelo',
  'identificador',
  'protocolo',
  'direccion_ip',
  'metadatos',
  'estado',
];

/** Normaliza a texto ISO o null. */
function aIso(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
}

/** Convierte un dispositivo de BD al payload de `dispositivo:actualizado`. */
function payloadActualizado(
  dispositivo: Device,
  camposCambiados: string[]
): PayloadDispositivoActualizado {
  return {
    dispositivo_id: dispositivo.id,
    identificador: dispositivo.identificador ?? null,
    estado: dispositivo.estado,
    ultima_conexion: aIso(dispositivo.ultima_conexion),
    direccion_ip: dispositivo.direccion_ip ?? null,
    metadatos: dispositivo.metadatos ?? {},
    campos_cambiados: camposCambiados,
  };
}

/** Compara dos valores de forma estructural (JSON) para detectar cambios. */
function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Detecta qué campos relevantes cambiaron entre dos versiones del dispositivo.
 * Devuelve la lista de nombres de campo.
 */
export function calcularCamposCambiados(
  anterior: Device | null,
  actual: Device
): string[] {
  if (!anterior) return [...CAMPOS_RELEVANTES] as string[];
  const cambiados: string[] = [];
  for (const campo of CAMPOS_RELEVANTES) {
    if (!iguales(anterior[campo], actual[campo])) cambiados.push(String(campo));
  }
  return cambiados;
}

/**
 * Emite `dispositivo:online` si y solo si el dispositivo pasó a `online`
 * desde un estado distinto.
 *
 * Devuelve `true` si emitió el evento.
 */
export function emitirDispositivoOnline(
  anterior: Device | null,
  actual: Device
): boolean {
  const eraOnline = anterior?.estado === 'online';
  const esOnline = actual.estado === 'online';
  if (!esOnline || eraOnline) return false;

  const payload: PayloadDispositivoOnline = {
    dispositivo_id: actual.id,
    identificador: actual.identificador ?? null,
    estado_anterior: anterior?.estado ?? 'desconocido',
    estado: 'online',
    ultima_conexion: aIso(actual.ultima_conexion),
  };
  emitirEvento({ tipo: 'dispositivo:online', datos: payload, emitido_en: new Date().toISOString() });
  return true;
}

/**
 * Emite `dispositivo:offline` solo en la transición online → offline.
 * Devuelve `true` si emitió el evento.
 */
export function emitirDispositivoOffline(
  anterior: Device | null,
  actual: Device,
  detectadoEn: Date = new Date()
): boolean {
  const estabaOffline = anterior?.estado === 'offline';
  if (actual.estado !== 'offline' || estabaOffline) return false;

  const payload: PayloadDispositivoOffline = {
    dispositivo_id: actual.id,
    identificador: actual.identificador ?? null,
    estado: 'offline',
    ultima_conexion: aIso(actual.ultima_conexion),
    detectado_en: detectadoEn.toISOString(),
  };
  emitirEvento({
    tipo: 'dispositivo:offline',
    datos: payload,
    emitido_en: new Date().toISOString(),
  });
  return true;
}

/**
 * Emite `dispositivo:actualizado` SOLO si cambió información relevante.
 *
 * Se usa en el heartbeat (IP/metadatos) y en ediciones relevantes. NO se usa
 * en cada medición: `ultima_conexion` cambia constantemente y generaría ruido;
 * para eso ya existe el evento de medición y `dispositivo:online`.
 *
 * Devuelve `true` si emitió el evento.
 */
export function emitirDispositivoActualizado(
  anterior: Device | null,
  actual: Device,
  camposCambiados: string[] = calcularCamposCambiados(anterior, actual)
): boolean {
  if (camposCambiados.length === 0) return false;

  emitirEvento({
    tipo: 'dispositivo:actualizado',
    datos: payloadActualizado(actual, camposCambiados),
    emitido_en: new Date().toISOString(),
  });
  return true;
}
