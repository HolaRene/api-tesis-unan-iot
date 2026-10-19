import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  cumpleCondicion,
  sigueEnAlarma,
  decidirConRetardo,
  type ReglaEvaluable,
} from './motor-alertas.js';

/**
 * Motor de alertas.
 *
 * Los casos están escritos como situaciones reales: un valor que oscila en
 * el borde, una presión que se invierte, un pico que no debe alarmar.
 */

const banda = (min: number, max: number, h = 0): ReglaEvaluable => ({
  operador: 'fuera_de_rango',
  valor_min: min,
  valor_max: max,
  histeresis: h,
});

describe('cumpleCondicion', () => {
  it('fuera_de_rango avisa al salir de la banda', () => {
    const r = banda(20, 24);
    assert.equal(cumpleCondicion(r, 19.9), true);
    assert.equal(cumpleCondicion(r, 24.1), true);
    assert.equal(cumpleCondicion(r, 22), false);
  });

  it('entre avisa DENTRO de la banda (ojo con la semántica)', () => {
    const r: ReglaEvaluable = { operador: 'entre', valor_min: 20, valor_max: 24 };
    assert.equal(cumpleCondicion(r, 22), true);
    assert.equal(cumpleCondicion(r, 19), false);
  });

  it('un valor nulo nunca cumple', () => {
    assert.equal(cumpleCondicion(banda(20, 24), null), false);
    assert.equal(cumpleCondicion(banda(20, 24), undefined), false);
  });
});

describe('histéresis', () => {
  it('evita el parpadeo en el borde de la banda', () => {
    // Sin histéresis: 23,99 → alerta; 24,01 → alerta; 23,99 → alerta…
    const sin = banda(20, 24, 0);
    assert.equal(cumpleCondicion(sin, 24.01), true);
    assert.equal(sigueEnAlarma(sin, 23.99), false);

    // Con histéresis 0,5: la alerta se mantiene hasta bajar de 23,5.
    const con = banda(20, 24, 0.5);
    assert.equal(sigueEnAlarma(con, 23.99), true, 'en el borde sigue en alarma');
    assert.equal(sigueEnAlarma(con, 23.6), true, 'aún no entró en la banda estrecha');
    assert.equal(sigueEnAlarma(con, 23.4), false, 'ya entró: se cierra');
  });

  it('estrecha también por el lado inferior', () => {
    const r = banda(20, 24, 0.5);
    assert.equal(sigueEnAlarma(r, 20.1), true);
    assert.equal(sigueEnAlarma(r, 20.6), false);
  });

  it('en comparaciones simples ensancha el umbral de cierre', () => {
    const r: ReglaEvaluable = {
      operador: '>',
      valor_referencia_numerico: 30,
      histeresis: 0.5,
    };
    // Abre por encima de 30, pero no cierra hasta bajar de 29,5.
    assert.equal(cumpleCondicion(r, 29.8), false);
    assert.equal(sigueEnAlarma(r, 29.8), true);
    assert.equal(sigueEnAlarma(r, 29.4), false);
  });

  it('sin histéresis se comporta como antes', () => {
    const r = banda(20, 24, 0);
    assert.equal(sigueEnAlarma(r, 24.1), true);
    assert.equal(sigueEnAlarma(r, 22), false);
  });
});

describe('retardo', () => {
  const t0 = new Date('2026-10-19T10:00:00Z');

  it('no abre hasta que pasa el retardo', () => {
    const r = { ...banda(20, 24), retardo_segundos: 60 };

    const a10s = decidirConRetardo(r, 30, new Date(t0.getTime() + 10_000), null, t0);
    assert.deepEqual(a10s, { accion: 'esperar', segundosTranscurridos: 10 });

    const a59s = decidirConRetardo(r, 30, new Date(t0.getTime() + 59_000), null, t0);
    assert.equal(a59s.accion, 'esperar');

    const a60s = decidirConRetardo(r, 30, new Date(t0.getTime() + 60_000), null, t0);
    assert.equal(a60s.accion, 'abrir');
  });

  it('sin retardo abre de inmediato', () => {
    const r = { ...banda(20, 24), retardo_segundos: 0 };
    assert.equal(decidirConRetardo(r, 30, t0, null, null).accion, 'abrir');
  });

  it('un pico que no dura no llega a alarmar', () => {
    const r = { ...banda(20, 24), retardo_segundos: 60 };

    // El valor se sale durante 20 s y vuelve: nunca pasa de 'esperar'.
    const paso1 = decidirConRetardo(r, 30, new Date(t0.getTime() + 10_000), null, t0);
    const paso2 = decidirConRetardo(r, 22, new Date(t0.getTime() + 20_000), null, t0);
    assert.equal(paso1.accion, 'esperar');
    assert.equal(paso2.accion, 'nada', 'al volver a la banda no se abre nada');
  });
});

describe('ciclo de la alerta', () => {
  const t0 = new Date('2026-10-19T10:00:00Z');
  const abierta = { estado: 'active', iniciada_en: t0 };

  it('se mantiene mientras siga habiendo alarma', () => {
    const r = banda(20, 24, 0.5);
    const d = decidirConRetardo(r, 25, new Date(t0.getTime() + 1_000), abierta, null);
    assert.equal(d.accion, 'mantener');
  });

  it('se resuelve al volver a la banda con margen', () => {
    const r = banda(20, 24, 0.5);
    const d = decidirConRetardo(r, 23.2, new Date(t0.getTime() + 1_000), abierta, null);
    assert.equal(d.accion, 'resolver');
  });

  it('el retardo no vuelve a aplicarse si ya estaba abierta', () => {
    const r = { ...banda(20, 24), retardo_segundos: 60 };
    const d = decidirConRetardo(r, 30, new Date(t0.getTime() + 1_000), abierta, null);
    assert.equal(d.accion, 'mantener', 'no se reabre ni se espera otra vez');
  });

  it('una alerta reconocida se resuelve igual que una activa', () => {
    const reconocida = { estado: 'acknowledged', iniciada_en: t0 };
    const r = banda(20, 24);
    const d = decidirConRetardo(r, 22, t0, reconocida, null);
    assert.equal(d.accion, 'resolver');
  });
});

describe('presión diferencial (caso hospitalario)', () => {
  const presionMinima: ReglaEvaluable = {
    operador: '<',
    valor_referencia_numerico: 2.5,
    retardo_segundos: 30,
    histeresis: 0.5,
  };

  it('una presión de 2,0 Pa es alarma', () => {
    assert.equal(cumpleCondicion(presionMinima, 2.0), true);
  });

  it('una presión invertida (-1 Pa) también es alarma', () => {
    assert.equal(cumpleCondicion(presionMinima, -1), true);
  });

  it('no cierra al rozar el umbral, solo al subir de 3,0', () => {
    // Abre por debajo de 2,5; cierra al superar 2,5 + 0,5.
    assert.equal(sigueEnAlarma(presionMinima, 2.6), true);
    assert.equal(sigueEnAlarma(presionMinima, 3.1), false);
  });
});

/**
 * Regresión: PostgreSQL devuelve NUMERIC como STRING.
 *
 * Las columnas `valor_min`, `valor_max` y `histeresis` llegan al driver `pg`
 * como "20" y "0.5000", no como números. Sin convertir, `"20" + 0.5` da
 * `"200.5"` por concatenación: la banda de cierre se hace enorme y la alerta
 * NO se cierra nunca.
 *
 * El fallo apareció probando contra la base real; con números en las pruebas
 * no se veía.
 */
describe('valores como string (PostgreSQL NUMERIC)', () => {
  const real: ReglaEvaluable = {
    operador: 'fuera_de_rango',
    valor_min: '20' as unknown as number,
    valor_max: '24' as unknown as number,
    histeresis: '0.5000' as unknown as number,
  };

  it('no concatena: 20 + 0.5 no debe dar 200.5', () => {
    const min = Number(real.valor_min) + Number(real.histeresis);
    assert.equal(min, 20.5);
  });

  it('detecta la alarma fuera de la banda', () => {
    assert.equal(cumpleCondicion(real, 30), true);
    assert.equal(cumpleCondicion(real, 22), false);
  });

  it('se mantiene en la zona de histéresis', () => {
    assert.equal(sigueEnAlarma(real, 24.3), true);
  });

  it('SE RESUELVE al volver de verdad a la banda', () => {
    // Este es el caso que fallaba: 23,0 está dentro de 20,5–23,5.
    assert.equal(sigueEnAlarma(real, 23.0), false);
  });

  it('el retardo también llega como string y se aplica', () => {
    const r = { ...real, retardo_segundos: '60' as unknown as number };
    const t0 = new Date('2026-10-19T10:00:00Z');
    const a30 = decidirConRetardo(r, 30, new Date(t0.getTime() + 30_000), null, t0);
    assert.equal(a30.accion, 'esperar');
    const a60 = decidirConRetardo(r, 30, new Date(t0.getTime() + 60_000), null, t0);
    assert.equal(a60.accion, 'abrir');
  });
});
