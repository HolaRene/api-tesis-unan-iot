/**
 * Tests de los emisores realtime de mediciones/canales.
 *
 * Verifican las reglas de agrupación (anti-ráfaga):
 *   - Un lote vacío no emite `medicion:nueva`.
 *   - `canal:actualizado` se agrupa: UNA vez por canal, no por medición.
 *   - Los lotes no revientan aunque no haya clientes conectados.
 *
 * El agrupamiento se prueba con la función pura `agruparPorCanal`, que no
 * depende del transporte WebSocket.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparPorCanal,
  emitirMedicionNueva,
  emitirCanalesActualizados,
  type MedicionReciente,
} from './mediciones.eventos.js';

function medicion(overrides: Partial<MedicionReciente> = {}): MedicionReciente {
  return {
    id: 1,
    canal_id: 'canal-1',
    canal_codigo: 'DHT22-01-TEMPERATURA',
    canal_nombre: 'DHT22 · Temperatura',
    canal_unidad: '°C',
    canal_tipo_dato: 'numeric',
    sensor_id: 'sensor-1',
    valor_numerico: 25.2,
    valor_texto: null,
    valor_booleano: null,
    valor_json: null,
    calidad: 'good',
    registrado_en: '2026-09-11T19:00:00.000Z',
    ...overrides,
  };
}

describe('emisores realtime de mediciones', () => {
  test('lote vacío no emite medicion:nueva', () => {
    assert.equal(emitirMedicionNueva('ESP32-Q2', []), 0);
  });

  test('un lote con mediciones se procesa sin errores', () => {
    const emitidos = emitirMedicionNueva('ESP32-Q2', [
      medicion(),
      medicion({ id: 2, canal_id: 'canal-2', canal_codigo: 'DHT22-01-HUMEDAD_RELATIVA' }),
    ]);
    assert.equal(emitidos, 0); // 0 clientes conectados en test
  });

  test('agruparPorCanal deja UNA entrada por canal', () => {
    const lote = [
      medicion({ id: 1, canal_id: 'canal-1' }),
      medicion({ id: 2, canal_id: 'canal-1' }),
      medicion({ id: 3, canal_id: 'canal-2' }),
    ];
    const agrupado = agruparPorCanal(lote);
    assert.equal(agrupado.length, 2, 'dos canales distintos');
  });

  test('agruparPorCanal conserva la ÚLTIMA medición de cada canal', () => {
    const lote = [
      medicion({ id: 1, canal_id: 'canal-1', valor_numerico: 20 }),
      medicion({ id: 2, canal_id: 'canal-1', valor_numerico: 30 }),
    ];
    const agrupado = agruparPorCanal(lote);
    assert.equal(agrupado.length, 1);
    assert.equal(agrupado[0].id, 2);
    assert.equal(agrupado[0].valor_numerico, 30);
  });

  test('agruparPorCanal ignora mediciones sin canal_id', () => {
    const agrupado = agruparPorCanal([
      medicion({ canal_id: null }),
      medicion({ id: 2, canal_id: null }),
    ]);
    assert.equal(agrupado.length, 0);
  });

  test('emitirCanalesActualizados con lote válido no lanza', () => {
    const emitidos = emitirCanalesActualizados([
      medicion({ id: 1, canal_id: 'canal-1' }),
      medicion({ id: 2, canal_id: 'canal-2' }),
    ]);
    assert.equal(emitidos, 0); // sin clientes conectados
  });
});
