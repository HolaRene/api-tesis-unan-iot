/**
 * Emisores de eventos realtime de MEDICIONES y CANALES.
 *
 * Punto ÚNICO de emisión. Deben llamarse **después** del COMMIT.
 *
 * A diferencia de los dispositivos, aquí SÍ se emite un evento por cada
 * medición guardada: es información nueva, no un cambio de estado. Aun así se
 * agrupa:
 *   - `medicion:nueva`    → una por lote (con el array de mediciones).
 *   - `canal:actualizado` → una por canal afectado (no una por medición).
 */
import { emitirEvento } from './websocket.servidor.js';

/** Resumen de una medición recién guardada. */
export interface MedicionReciente {
  id: number;
  canal_id: string | null;
  canal_codigo: string | null;
  /** Nombre legible del canal (para parchear la UI sin refetch). */
  canal_nombre: string | null;
  /** Unidad del canal (p. ej. `°C`). */
  canal_unidad: string | null;
  /** `numeric` / `boolean` / `text` (para decidir qué campo usar en la UI). */
  canal_tipo_dato: string | null;
  sensor_id: string | null;
  valor_numerico: number | null;
  valor_texto: string | null;
  valor_booleano: boolean | null;
  valor_json: Record<string, unknown> | null;
  calidad: string;
  registrado_en: string | null;
}

/**
 * Emite `medicion:nueva` con el lote de mediciones guardadas.
 *
 * Se emite UNA vez por lote (no una por medición) para no generar ráfagas.
 * Devuelve cuántos clientes lo recibieron.
 */
export function emitirMedicionNueva(
  dispositivoIdentificador: string | null,
  mediciones: MedicionReciente[]
): number {
  if (mediciones.length === 0) return 0;
  return emitirEvento({
    tipo: 'medicion:nueva',
    datos: {
      dispositivo: dispositivoIdentificador,
      total: mediciones.length,
      mediciones,
    },
    emitido_en: new Date().toISOString(),
  });
}

/**
 * Agrupa un lote de mediciones por canal, quedándose con la ÚLTIMA de cada
 * canal. Función pura (fácil de testear): así `canal:actualizado` se emite una
 * vez por canal y no una vez por medición.
 */
export function agruparPorCanal(
  mediciones: MedicionReciente[]
): MedicionReciente[] {
  const porCanal = new Map<string, MedicionReciente>();
  for (const m of mediciones) {
    if (m.canal_id) porCanal.set(m.canal_id, m);
  }
  return [...porCanal.values()];
}

/**
 * Emite `canal:actualizado` UNA vez por canal afectado (aunque el lote traiga
 * varias mediciones del mismo canal), con el último valor recibido.
 */
export function emitirCanalesActualizados(
  mediciones: MedicionReciente[]
): number {
  let emitidos = 0;
  for (const m of agruparPorCanal(mediciones)) {
    emitidos += emitirEvento({
      tipo: 'canal:actualizado',
      datos: {
        canal_id: m.canal_id,
        canal_codigo: m.canal_codigo,
        canal_nombre: m.canal_nombre,
        canal_unidad: m.canal_unidad,
        canal_tipo_dato: m.canal_tipo_dato,
        sensor_id: m.sensor_id,
        ultimo_valor_numerico: m.valor_numerico,
        ultimo_valor_texto: m.valor_texto,
        ultimo_valor_booleano: m.valor_booleano,
        calidad: m.calidad,
        registrado_en: m.registrado_en,
      },
      emitido_en: new Date().toISOString(),
    });
  }
  return emitidos;
}
