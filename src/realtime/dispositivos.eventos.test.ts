/**
 * Tests de los emisores realtime de dispositivos.
 *
 * Cubren las reglas anti-ruido (casos de la especificación):
 *   CASO 1  Dispositivo nuevo/envía medición        → dispositivo:online
 *   CASO 2  Dispositivo ya online envía medición    → NO dispositivo:online
 *   CASO 3  Heartbeat cambia RSSI                   → dispositivo:actualizado
 *   CASO 4  Watchdog online → offline               → dispositivo:offline
 *   CASO 5  Watchdog con el dispositivo ya offline  → NO dispositivo:offline
 *   CASO 6  Offline → online (vuelve a medir)       → dispositivo:online
 *
 * Se ejecuta con el runner nativo de Node:
 *   pnpm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  emitirDispositivoActualizado,
  emitirDispositivoOffline,
  emitirDispositivoOnline,
  calcularCamposCambiados,
} from './dispositivos.eventos.js';

/**
 * Los emisores aplican la decisión anti-ruido y **devuelven** si emitirían o
 * no. Ese valor de retorno es exactamente lo que verifican estos tests (y es lo
 * que consumen la ingesta, el heartbeat y el watchdog). No se levanta ningún
 * servidor WebSocket: la emisión real requiere clientes conectados.
 */
function dispositivo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-1',
    area_id: null,
    nombre: 'ESP32-Q2',
    tipo: 'esp32',
    fabricante: null,
    modelo: null,
    identificador: 'ESP32-Q2',
    protocolo: 'mqtt',
    direccion_ip: '192.168.1.42',
    estado: 'online',
    metadatos: { firmware: '1.4.2', rssi: -58 },
    ultima_conexion: new Date('2026-09-11T16:00:00.000Z'),
    creado_en: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('emisores realtime de dispositivos', () => {
  test('CASO 1: dispositivo nuevo → emite dispositivo:online', () => {
    const actual = dispositivo({ estado: 'online' });
    const emitido = emitirDispositivoOnline(null, actual);
    assert.equal(emitido, true, 'debe emitir online en el primer contacto');
  });

  test('CASO 1b: offline → online emite dispositivo:online', () => {
    const anterior = dispositivo({ estado: 'offline' });
    const actual = dispositivo({ estado: 'online' });
    assert.equal(emitirDispositivoOnline(anterior, actual), true);
  });

  test('CASO 2: ya estaba online → NO emite dispositivo:online', () => {
    const anterior = dispositivo({ estado: 'online' });
    const actual = dispositivo({ estado: 'online' });
    assert.equal(
      emitirDispositivoOnline(anterior, actual),
      false,
      'no debe repetir online en cada medición'
    );
  });

  test('CASO 3: heartbeat cambia RSSI → emite dispositivo:actualizado', () => {
    const anterior = dispositivo({ metadatos: { firmware: '1.4.2', rssi: -58 } });
    const actual = dispositivo({ metadatos: { firmware: '1.4.2', rssi: -70 } });
    assert.equal(emitirDispositivoActualizado(anterior, actual), true);
  });

  test('CASO 3b: heartbeat sin cambios relevantes → NO emite actualizado', () => {
    const anterior = dispositivo();
    const actual = dispositivo();
    assert.equal(emitirDispositivoActualizado(anterior, actual), false);
  });

  test('CASO 3c: solo cambia ultima_conexion → NO emite actualizado (anti-ruido)', () => {
    const anterior = dispositivo({
      ultima_conexion: new Date('2026-09-11T16:00:00.000Z'),
    });
    const actual = dispositivo({
      ultima_conexion: new Date('2026-09-11T16:00:30.000Z'),
    });
    assert.equal(emitirDispositivoActualizado(anterior, actual), false);
  });

  test('CASO 4: online → offline emite dispositivo:offline', () => {
    const anterior = dispositivo({ estado: 'online' });
    const actual = dispositivo({ estado: 'offline' });
    assert.equal(emitirDispositivoOffline(anterior, actual), true);
  });

  test('CASO 5: ya estaba offline → NO emite dispositivo:offline', () => {
    const anterior = dispositivo({ estado: 'offline' });
    const actual = dispositivo({ estado: 'offline' });
    assert.equal(
      emitirDispositivoOffline(anterior, actual),
      false,
      'no debe repetir offline en cada ciclo del watchdog'
    );
  });

  test('CASO 6: offline vuelve a medir → emite online (y no offline)', () => {
    const anterior = dispositivo({ estado: 'offline' });
    const actual = dispositivo({ estado: 'online' });
    assert.equal(emitirDispositivoOnline(anterior, actual), true);
    assert.equal(emitirDispositivoOffline(anterior, actual), false);
  });

  test('calcularCamposCambiados detecta los campos relevantes', () => {
    const anterior = dispositivo({ direccion_ip: '192.168.1.42' });
    const actual = dispositivo({ direccion_ip: '192.168.1.99' });
    assert.deepEqual(calcularCamposCambiados(anterior, actual), ['direccion_ip']);
  });

  test('calcularCamposCambiados ignora ultima_conexion', () => {
    const anterior = dispositivo({ ultima_conexion: new Date(0) });
    const actual = dispositivo({ ultima_conexion: new Date(1_000_000) });
    assert.deepEqual(calcularCamposCambiados(anterior, actual), []);
  });
});
