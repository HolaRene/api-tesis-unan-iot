/**
 * Tests de la generación de identificadores.
 *
 * Estos identificadores son clave única en la base de datos y los usa el
 * hardware para identificarse, así que su formato debe ser predecible y
 * estable: un cambio aquí rompería equipos ya instalados.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizarIdentificador,
  conSufijo,
  identificadorUnico,
  identificadorDeDispositivo,
  codigoDeCanal,
} from './identificadores.js';

describe('normalizarIdentificador', () => {
  test('convierte un nombre normal en mayúsculas con guiones', () => {
    assert.equal(normalizarIdentificador('Sensor Quirofano 1'), 'SENSOR-QUIROFANO-1');
  });

  test('QUITA los acentos en lugar de borrar la letra', () => {
    // Sin quitar las tildes saldría "QUIR-FANO", que no se parece al nombre.
    assert.equal(normalizarIdentificador('Quirófano'), 'QUIROFANO');
    assert.equal(normalizarIdentificador('Área Crítica'), 'AREA-CRITICA');
    assert.equal(normalizarIdentificador('Medición'), 'MEDICION');
  });

  test('colapsa los separadores repetidos', () => {
    assert.equal(normalizarIdentificador('Sensor   de    Area'), 'SENSOR-DE-AREA');
    assert.equal(normalizarIdentificador('a---b'), 'A-B');
  });

  test('quita los separadores de los extremos', () => {
    assert.equal(normalizarIdentificador('  --prueba--  '), 'PRUEBA');
    assert.equal(normalizarIdentificador('___test___'), 'TEST');
  });

  test('descarta símbolos que romperían una URL', () => {
    assert.equal(normalizarIdentificador('Sensor #1 (nuevo)'), 'SENSOR-1-NUEVO');
    assert.equal(normalizarIdentificador('a/b\\c'), 'A-B-C');
  });

  test('respeta el separador y las minúsculas si se piden', () => {
    assert.equal(normalizarIdentificador('Sensor Uno', '_'), 'SENSOR_UNO');
    assert.equal(normalizarIdentificador('Sensor Uno', '-', false), 'sensor-uno');
  });

  test('un texto sin caracteres válidos devuelve cadena vacía', () => {
    // No debe devolver guiones sueltos.
    assert.equal(normalizarIdentificador('---'), '');
    assert.equal(normalizarIdentificador('   '), '');
  });
});

describe('conSufijo', () => {
  test('el primer intento no lleva sufijo', () => {
    // El caso normal (sin colisión) debe dar el identificador limpio.
    assert.equal(conSufijo('SENSOR-1', 1), 'SENSOR-1');
  });

  test('a partir del segundo añade el número', () => {
    assert.equal(conSufijo('SENSOR-1', 2), 'SENSOR-1-2');
    assert.equal(conSufijo('SENSOR-1', 3), 'SENSOR-1-3');
  });
});

describe('identificadorUnico', () => {
  test('devuelve el base si está libre', async () => {
    const r = await identificadorUnico('SENSOR-1', async () => false);
    assert.equal(r, 'SENSOR-1');
  });

  test('salta los ocupados hasta encontrar uno libre', async () => {
    const ocupados = new Set(['SENSOR-1', 'SENSOR-1-2', 'SENSOR-1-3']);
    const r = await identificadorUnico('SENSOR-1', async (c) => ocupados.has(c));
    assert.equal(r, 'SENSOR-1-4');
  });

  test('falla de forma explícita si no hay hueco', async () => {
    // Es preferible un error claro a devolver un duplicado que la base de
    // datos rechazaría con un mensaje opaco.
    await assert.rejects(
      () => identificadorUnico('X', async () => true, 5),
      /No se pudo generar un identificador único/
    );
  });
});

describe('identificadorDeDispositivo', () => {
  test('deriva del nombre', () => {
    assert.equal(identificadorDeDispositivo('ESP32 Quirófano'), 'ESP32-QUIROFANO');
  });

  test('nunca devuelve vacío', () => {
    // El identificador es obligatorio para la integración: si el nombre no
    // produce nada usable, hace falta un valor por defecto.
    assert.equal(identificadorDeDispositivo('---'), 'DISPOSITIVO');
    assert.equal(identificadorDeDispositivo(''), 'DISPOSITIVO');
  });
});

describe('codigoDeCanal', () => {
  test('combina sensor y magnitud', () => {
    assert.equal(codigoDeCanal('DHT1W', 'TEMPERATURA'), 'DHT1W-TEMPERATURA');
    assert.equal(
      codigoDeCanal('DHT1W', 'HUMEDAD_RELATIVA'),
      'DHT1W-HUMEDAD-RELATIVA'
    );
  });

  test('NO repite la magnitud si el sensor ya la contiene', () => {
    // Evita "DHT1W-DHT1W-TEMPERATURA", que era el fallo a prevenir.
    assert.equal(codigoDeCanal('DHT1W-TEMPERATURA', 'TEMPERATURA'), 'DHT1W-TEMPERATURA');
  });

  test('sin magnitud devuelve solo el sensor', () => {
    assert.equal(codigoDeCanal('DHT1W'), 'DHT1W');
    assert.equal(codigoDeCanal('DHT1W', null), 'DHT1W');
  });

  test('nunca devuelve vacío', () => {
    assert.equal(codigoDeCanal('', ''), 'CANAL');
  });
});
