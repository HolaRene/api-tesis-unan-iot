/**
 * Tests del direccionamiento de actuadores.
 *
 * ────────────────────────────────────────────────────────────────────
 * EL FALLO QUE ESTOS TESTS EVITAN
 * ────────────────────────────────────────────────────────────────────
 * Los comandos salían con el CÓDIGO del actuador y sin dirección:
 *
 *     { "actuador": "LED-1", "comando": "ON" }
 *
 * Un PLC no entiende eso: solo sabe «en la dirección 100, pon un 1». Si el
 * direccionamiento se construye mal (o no se construye), el comando llega
 * al equipo y no ocurre nada, sin ningún error visible.
 *
 * Por eso el formato del bloque `direccionamiento` es un contrato y se fija
 * aquí.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validarDireccionamiento,
  construirDireccionamiento,
  PROTOCOLOS_ACTUADOR,
} from './direccionamiento.js';

describe('validarDireccionamiento', () => {
  /* ── Modbus: el caso que motivó todo ── */

  test('modbus completo es válido', () => {
    assert.deepEqual(
      validarDireccionamiento('modbus', {
        tipo: 'coil',
        direccion: 100,
        unidad_id: 1,
      }),
      []
    );
  });

  test('modbus SIN dirección se rechaza', () => {
    // Es el fallo original: un actuador accionable sin saber dónde escribir.
    const p = validarDireccionamiento('modbus', {});
    assert.ok(p.length > 0, 'debería avisar de que falta la dirección');
  });

  test('modbus con dirección fuera de rango se rechaza', () => {
    // 65535 es el máximo de Modbus.
    assert.ok(
      validarDireccionamiento('modbus', { tipo: 'coil', direccion: 70000 }).length > 0
    );
    assert.ok(
      validarDireccionamiento('modbus', { tipo: 'coil', direccion: -1 }).length > 0
    );
  });

  test('modbus rechaza los tipos de SOLO LECTURA', () => {
    // Un discrete input no se puede escribir: no sirve para accionar.
    assert.ok(
      validarDireccionamiento('modbus', { tipo: 'discrete', direccion: 1 }).length > 0
    );
  });

  test('modbus exige el tipo de registro', () => {
    assert.ok(validarDireccionamiento('modbus', { direccion: 100 }).length > 0);
  });

  /* ── GPIO ── */

  test('gpio con pin es válido', () => {
    assert.deepEqual(validarDireccionamiento('gpio', { pin: 2 }), []);
  });

  test('gpio SIN pin se rechaza', () => {
    assert.ok(validarDireccionamiento('gpio', {}).length > 0);
  });

  test('gpio acepta nivel activo bajo (relés invertidos)', () => {
    // Muchos relés se activan con 0 V; sin esto habría que invertir la
    // lógica en el firmware, que es donde peor se encuentra.
    assert.deepEqual(
      validarDireccionamiento('gpio', { pin: 5, nivel_activo: 0 }),
      []
    );
  });

  /* ── MQTT ── */

  test('mqtt sin configuración es válido (el tema se deriva del código)', () => {
    assert.deepEqual(validarDireccionamiento('mqtt', {}), []);
    assert.deepEqual(validarDireccionamiento('mqtt', null), []);
  });

  /* ── HTTP ── */

  test('http exige una URL válida', () => {
    assert.deepEqual(
      validarDireccionamiento('http', { url: 'http://192.168.1.50/rele' }),
      []
    );
    assert.ok(validarDireccionamiento('http', { url: 'no-es-una-url' }).length > 0);
    assert.ok(validarDireccionamiento('http', {}).length > 0);
  });

  /* ── Protocolo desconocido ── */

  test('un protocolo desconocido se rechaza', () => {
    assert.ok(validarDireccionamiento('z-wave', {}).length > 0);
  });

  test('se admiten exactamente los cuatro protocolos', () => {
    assert.deepEqual([...PROTOCOLOS_ACTUADOR], ['modbus', 'gpio', 'mqtt', 'http']);
  });
});

describe('construirDireccionamiento', () => {
  test('modbus aplana dirección y tipo', () => {
    // Se aplana para que Node-RED lea `direccionamiento.direccion` sin
    // navegar dentro de un objeto genérico.
    const d = construirDireccionamiento('modbus', {
      tipo: 'coil',
      direccion: 100,
      unidad_id: 1,
    });
    assert.equal(d.protocolo, 'modbus');
    assert.equal(d.tipo, 'coil');
    assert.equal(d.direccion, 100);
    assert.equal(d.unidad_id, 1);
  });

  test('modbus pone valores 1/0 por defecto', () => {
    // En un coil solo existen 1 y 0.
    const d = construirDireccionamiento('modbus', { tipo: 'coil', direccion: 5 });
    assert.equal(d.valor_on, 1);
    assert.equal(d.valor_off, 0);
  });

  test('modbus respeta valores personalizados de registro', () => {
    // Un registro holding puede necesitar otro valor, por ejemplo 255.
    const d = construirDireccionamiento('modbus', {
      tipo: 'holding',
      direccion: 40001,
      valor_on: 255,
      valor_off: 0,
    });
    assert.equal(d.valor_on, 255);
  });

  test('gpio traduce nivel activo a valores', () => {
    const alto = construirDireccionamiento('gpio', { pin: 2 });
    assert.equal(alto.valor_on, 1);
    assert.equal(alto.valor_off, 0);

    const bajo = construirDireccionamiento('gpio', { pin: 2, nivel_activo: 0 });
    // Relé invertido: activar es escribir 0.
    assert.equal(bajo.valor_on, 0);
    assert.equal(bajo.valor_off, 1);
  });

  test('mqtt deja el tema vacío si no se configura', () => {
    // Sin tema explícito, quien publica lo deriva del código.
    const d = construirDireccionamiento('mqtt', {});
    assert.equal(d.topico, undefined);
    assert.equal(d.valor_on, 'ON');
    assert.equal(d.valor_off, 'OFF');
  });

  test('http devuelve url y método por defecto', () => {
    const d = construirDireccionamiento('http', { url: 'http://x/y' });
    assert.equal(d.url, 'http://x/y');
    assert.equal(d.metodo, 'POST');
  });

  test('un protocolo desconocido NO rompe: cae en mqtt', () => {
    // Preferible un comportamiento por defecto antes que lanzar y tumbar
    // la entrega de comandos.
    const d = construirDireccionamiento('inventado', {});
    assert.equal(d.protocolo, 'mqtt');
  });

  test('configuración nula no rompe', () => {
    const d = construirDireccionamiento('modbus', null);
    assert.equal(d.protocolo, 'modbus');
    assert.deepEqual(d.configuracion, {});
  });

  test('conserva la configuración original', () => {
    // Por si hay campos que no se listan explícitamente.
    const cfg = { tipo: 'coil', direccion: 3, campo_extra: 'x' };
    const d = construirDireccionamiento('modbus', cfg);
    assert.deepEqual(d.configuracion, cfg);
  });
});
