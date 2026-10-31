/**
 * Nivel de un valor según las reglas de su canal.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ ES (Y QUÉ NO ES) EL NIVEL
 * ──────────────────────────────────────────────────────────────────────
 * La medición guardada es CRUDA: valor, unidad, hora y `calidad`.
 *
 *   `calidad` (`good` / `bad`) dice si el dato del SENSOR es válido
 *   (¿llega señal? ¿el lazo está roto?). No dice nada de si el valor es
 *   aceptable para el recinto.
 *
 *   `nivel` dice si el valor CUMPLE las reglas del canal. Se calcula al
 *   LEER, no se guarda: si mañana se cambia un umbral, el histórico se
 *   reinterpreta con el criterio nuevo sin reescribir la tabla.
 *
 * Valores:
 *   bueno        ninguna regla se dispara
 *   advertencia  se dispara una regla `warning`
 *   critico      se dispara una regla `critical`
 *   falla        la calidad es `bad` (sensor averiado, no valor alto/bajo)
 *   sin_datos    no hay valor
 *   sin_regla    el canal no tiene reglas activas
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ SE CACHEAN LAS REGLAS
 * ──────────────────────────────────────────────────────────────────────
 * Al calcular el nivel de una página de 100 mediciones se necesitan las
 * reglas de sus canales. Consultarlas por fila sería un N+1 brutal.
 *
 * Pero además, en la ingesta llegan muchas mediciones por segundo, y ahí
 * una consulta por medición tampoco es aceptable. La caché guarda las
 * reglas de cada canal durante `VIDA_CACHE_MS`.
 *
 * Se invalida al crear, editar o borrar una regla: si se cambiara un
 * umbral, el siguiente valor debería clasificarse con el criterio nuevo de
 * inmediato, no 30 segundos después.
 */
import { query } from '../../database/pool.js';

export type NivelMedicion =
  | 'bueno'
  | 'advertencia'
  | 'critico'
  | 'falla'
  | 'sin_datos'
  | 'sin_regla';

/** Forma mínima que necesita la clasificación. */
export interface ReglaNivel {
  operador: string;
  valor_referencia_numerico?: number | string | null;
  valor_min?: number | string | null;
  valor_max?: number | string | null;
  valor_referencia_texto?: string | null;
  severidad: string;
}

const VIDA_CACHE_MS = 30_000;

interface EntradaCache {
  reglas: ReglaNivel[];
  cargadaEn: number;
}

const cache = new Map<string, EntradaCache>();

/**
 * Convierte a número lo que PostgreSQL pueda devolver como texto.
 *
 * Las columnas NUMERIC llegan al driver `pg` como string. Sin esta
 * conversión, `"18" > "9"` compara alfabéticamente. Ya provocó un fallo en
 * la histéresis de las alertas.
 */
function aNumero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ¿El valor dispara ESTA regla? (la regla describe la condición de alarma). */
export function cumpleRegla(regla: ReglaNivel, valor: number): boolean {
  const ref = aNumero(regla.valor_referencia_numerico);
  const min = aNumero(regla.valor_min);
  const max = aNumero(regla.valor_max);

  switch (regla.operador) {
    case '>':
      return ref !== null && valor > ref;
    case '>=':
      return ref !== null && valor >= ref;
    case '<':
      return ref !== null && valor < ref;
    case '<=':
      return ref !== null && valor <= ref;
    case 'fuera_de_rango':
      // Avisa si el valor SALE de la banda [min, max].
      return (min !== null && valor < min) || (max !== null && valor > max);
    case 'entre':
      // Ojo: avisa si el valor ESTÁ DENTRO. Es el operador original del
      // proyecto; para expresar una banda aceptable se usa fuera_de_rango.
      return min !== null && max !== null && valor >= min && valor <= max;
    default:
      return false;
  }
}

/**
 * Clasifica un valor.
 *
 * `calidad = 'bad'` devuelve `falla` sin mirar las reglas: un sensor
 * averiado no entrega un valor que se pueda comparar con un umbral. Es
 * distinto de «crítico», y confundirlos tapa el problema real.
 */
export function clasificarNivel(
  valor: number | null | undefined,
  reglas: ReglaNivel[] | null | undefined,
  calidad?: string | null
): NivelMedicion {
  if ((calidad ?? 'good').toLowerCase() === 'bad') return 'falla';

  const lista = reglas ?? [];
  if (lista.length === 0) return 'sin_regla';
  if (valor === null || valor === undefined) return 'sin_datos';

  if (lista.some((r) => r.severidad === 'critical' && cumpleRegla(r, valor))) {
    return 'critico';
  }
  if (lista.some((r) => r.severidad === 'warning' && cumpleRegla(r, valor))) {
    return 'advertencia';
  }
  return 'bueno';
}

/**
 * Reglas activas de varios canales, en UNA sola consulta.
 *
 * Devuelve un mapa `canal_id → reglas`. Los canales sin reglas no aparecen:
 * `clasificarNivel` los trata como `sin_regla`.
 */
export async function reglasPorCanal(
  canalIds: string[]
): Promise<Map<string, ReglaNivel[]>> {
  const mapa = new Map<string, ReglaNivel[]>();
  const ids = [...new Set(canalIds.filter(Boolean))];
  if (ids.length === 0) return mapa;

  const r = await query<ReglaNivel & { canal_id: string }>(
    `SELECT canal_id, operador, valor_referencia_numerico,
            valor_min, valor_max, valor_referencia_texto, severidad
       FROM reglas_alerta
      WHERE canal_id = ANY($1::uuid[]) AND activa = TRUE`,
    [ids]
  );

  for (const fila of r.rows) {
    const lista = mapa.get(fila.canal_id) ?? [];
    lista.push(fila);
    mapa.set(fila.canal_id, lista);
  }

  return mapa;
}

/**
 * Reglas de un canal con caché.
 *
 * Para la ingesta: llegan muchas mediciones del mismo canal seguidas.
 */
export async function reglasDeCanalConCache(
  canalId: string
): Promise<ReglaNivel[]> {
  const entrada = cache.get(canalId);
  const ahora = Date.now();

  if (entrada && ahora - entrada.cargadaEn < VIDA_CACHE_MS) {
    return entrada.reglas;
  }

  const mapa = await reglasPorCanal([canalId]);
  const reglas = mapa.get(canalId) ?? [];
  cache.set(canalId, { reglas, cargadaEn: ahora });
  return reglas;
}

/**
 * Vacía la caché de un canal (o toda).
 *
 * Se llama al crear, editar o borrar una regla: un umbral cambiado debe
 * aplicar al siguiente valor, no 30 segundos después.
 */
export function invalidarCacheNivel(canalId?: string): void {
  if (canalId) cache.delete(canalId);
  else cache.clear();
}
