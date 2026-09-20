/**
 * Emisores de eventos realtime de ALERTAS.
 *
 * Punto ÚNICO de emisión. Deben llamarse **después** del COMMIT.
 *
 *   - `alerta:creada`      → al insertar una alerta nueva.
 *   - `alerta:actualizada` → al reconocerla o cambiar cualquier campo.
 *   - `alerta:resuelta`    → al pasar a estado `resolved`.
 *
 * Reglas anti-ruido:
 *   - Resolver una alerta ya resuelta NO emite `alerta:resuelta`
 *     (el `UPDATE` solo toca `active`/`acknowledged`).
 *   - `alerta:resuelta` implica `alerta:actualizada`: se emite SOLO el evento
 *     específico (`alerta:resuelta`) para no duplicar.
 */
import type { Alert } from '../modules/alerts/alert.types.js';
import { emitirEvento } from './websocket.servidor.js';

/** Normaliza la fecha a ISO string (o null). */
function aIso(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
}

/** Proyección de la alerta que viaja en el evento (evita enviar de más). */
function payloadAlerta(alerta: Alert) {
  return {
    id: alerta.id,
    regla_id: alerta.regla_id ?? null,
    canal_id: alerta.canal_id ?? null,
    sensor_id: alerta.sensor_id ?? null,
    medicion_id: alerta.medicion_id ?? null,
    tipo: alerta.tipo ?? null,
    severidad: alerta.severidad ?? null,
    mensaje: alerta.mensaje ?? null,
    estado: alerta.estado,
    iniciada_en: aIso(alerta.iniciada_en),
    reconocida_en: aIso(alerta.reconocida_en),
    finalizada_en: aIso(alerta.finalizada_en),
    metadatos: alerta.metadatos ?? {},
  };
}

/** Emite `alerta:creada`. */
export function emitirAlertaCreada(alerta: Alert): boolean {
  emitirEvento({
    tipo: 'alerta:creada',
    datos: payloadAlerta(alerta),
    emitido_en: new Date().toISOString(),
  });
  return true;
}

/**
 * Emite `alerta:actualizada` (reconocida, cambio de severidad, etc.).
 * No se usa cuando el cambio ES la resolución: para eso está
 * `emitirAlertaResuelta`.
 */
export function emitirAlertaActualizada(alerta: Alert): boolean {
  emitirEvento({
    tipo: 'alerta:actualizada',
    datos: payloadAlerta(alerta),
    emitido_en: new Date().toISOString(),
  });
  return true;
}

/** Emite `alerta:resuelta`. Devuelve false si la alerta no está resuelta. */
export function emitirAlertaResuelta(alerta: Alert): boolean {
  if (alerta.estado !== 'resolved') return false;
  emitirEvento({
    tipo: 'alerta:resuelta',
    datos: payloadAlerta(alerta),
    emitido_en: new Date().toISOString(),
  });
  return true;
}

/**
 * Decide QUÉ tipo de evento corresponde a un cambio de alerta.
 *
 * Función pura (testeable) que centraliza la regla anti-duplicación:
 *   - `resolved`            → `alerta:resuelta` (NO se emite además "actualizada")
 *   - cualquier otro estado → `alerta:actualizada`
 */
export function tipoEventoDeAlerta(
  alerta: Pick<Alert, 'estado'>
): 'alerta:resuelta' | 'alerta:actualizada' {
  return alerta.estado === 'resolved' ? 'alerta:resuelta' : 'alerta:actualizada';
}

/**
 * Emite el evento adecuado tras un cambio de estado.
 * Se emite UN solo evento (nunca ambos) para no duplicar en el cliente.
 */
export function emitirCambioDeAlerta(alerta: Alert): boolean {
  if (tipoEventoDeAlerta(alerta) === 'alerta:resuelta') {
    return emitirAlertaResuelta(alerta);
  }
  return emitirAlertaActualizada(alerta);
}
