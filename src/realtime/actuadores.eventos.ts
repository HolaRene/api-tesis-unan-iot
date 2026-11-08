/**
 * Eventos en tiempo real de actuadores y comandos.
 *
 * ──────────────────────────────────────────────────────────────────────
 * EL PROBLEMA QUE RESUELVE
 * ──────────────────────────────────────────────────────────────────────
 * Al pulsar un botón del dashboard, el comando se encolaba y la interfaz
 * decía «encolado». Pero el resultado real (`ejecutado` / `fallido`) solo
 * aparecía cuando el navegador volvía a pedir la lista:
 *
 *   - si el usuario hacía otra acción, o
 *   - cuando tocaba el siguiente refresco.
 *
 * Es decir: el estado del actuador no se actualizaba solo. El usuario veía
 * un botón que no daba señal de haber funcionado aunque el equipo ya
 * hubiera actuado.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ SE EMITE
 * ──────────────────────────────────────────────────────────────────────
 *   comando:actualizado   en cada cambio de estado del comando
 *   actuador:actualizado  cuando cambia el estado REAL del equipo
 *
 * Se emiten DOS eventos porque responden a preguntas distintas: el primero
 * es «¿en qué va mi orden?» y el segundo «¿en qué estado está el equipo?».
 *
 * ──────────────────────────────────────────────────────────────────────
 * REGLA DE ORO
 * ──────────────────────────────────────────────────────────────────────
 * Se emite SIEMPRE después del COMMIT. Un evento que anuncia algo que no
 * se guardó deja la interfaz mostrando un estado que la base no tiene.
 */
import { emitirEvento } from './websocket.servidor.js';
import type {
  PayloadComandoActualizado,
  PayloadActuadorActualizado,
} from './eventos.js';

/**
 * Emite el cambio de estado de un comando.
 *
 * @param c Fila del comando con su actuador (ya persistida).
 */
export function emitirComandoActualizado(c: {
  id: string;
  actuador_id: string;
  actuador_codigo?: string | null;
  comando: string;
  estado: string | null;
  respuesta?: unknown;
  creado_en?: Date | string | null;
  ejecutado_en?: Date | string | null;
}): number {
  /*
   * El motivo del fallo vive dentro de `respuesta` (por ejemplo
   * `{ motivo: 'timeout' }`). Se extrae para que la web pueda decir
   * «no confirmó a tiempo» en lugar de un genérico «fallido».
   */
  const respuesta = c.respuesta as { motivo?: unknown } | null | undefined;
  const motivo =
    respuesta && typeof respuesta.motivo === 'string' ? respuesta.motivo : null;

  const datos: PayloadComandoActualizado = {
    comando_id: c.id,
    actuador_id: c.actuador_id,
    actuador_codigo: c.actuador_codigo ?? '',
    comando: c.comando,
    estado: c.estado ?? 'pendiente',
    motivo,
    creado_en: aIso(c.creado_en),
    ejecutado_en: aIso(c.ejecutado_en),
  };

  return emitirEvento({
    tipo: 'comando:actualizado',
    datos,
    emitido_en: new Date().toISOString(),
  });
}

/** Emite el cambio de estado real de un actuador. */
export function emitirActuadorActualizado(a: {
  id: string;
  codigo: string;
  nombre?: string | null;
  estado_actual: string | null;
  ultima_orden_en?: Date | string | null;
}): number {
  const datos: PayloadActuadorActualizado = {
    actuador_id: a.id,
    codigo: a.codigo,
    nombre: a.nombre ?? null,
    estado_actual: a.estado_actual,
    ultima_orden_en: aIso(a.ultima_orden_en),
  };

  return emitirEvento({
    tipo: 'actuador:actualizado',
    datos,
    emitido_en: new Date().toISOString(),
  });
}

function aIso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}
