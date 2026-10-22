import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  diagnosticarValor,
  evaluarUmbral,
  VALOR_CENTINELA_FALLA,
  NAMUR,
} from './falla-lazo.js';

/**
 * Detección de falla de lazo.
 *
 * El caso que motivó esto: el PLC simulado envía -32768 cuando se activa
 * `%MW1`. Antes entraba como medición válida y generaba una alarma de
 * «temperatura baja», escondiendo que el sensor estaba averiado.
 */

describe('centinela -32768', () => {
  it('se detecta como falla', () => {
    const d = diagnosticarValor(VALOR_CENTINELA_FALLA);
    assert.equal(d.falla, true);
    assert.equal(d.calidad, 'bad');
    assert.equal(d.deteccion, 'centinela');
  });

  it('el motivo menciona el centinela', () => {
    const d = diagnosticarValor(-32768);
    assert.match(d.motivo ?? '', /-32768/);
  });

  it('un valor normal no es falla', () => {
    const d = diagnosticarValor(23.4);
    assert.equal(d.falla, false);
    assert.equal(d.calidad, 'good');
  });

  it('-32767 NO es falla (solo el centinela exacto)', () => {
    const d = diagnosticarValor(-32767);
    assert.equal(d.falla, false);
  });
});

describe('umbrales NAMUR NE 43', () => {
  const opciones = { esCorriente: true };

  it('por debajo de 3,6 mA es falla', () => {
    const d = diagnosticarValor(2.0, opciones);
    assert.equal(d.falla, true);
    assert.equal(d.calidad, 'bad');
    assert.equal(d.deteccion, 'corriente');
  });

  it('el límite exacto 3,6 mA ya NO es falla', () => {
    const d = diagnosticarValor(NAMUR.FALLA_MA, opciones);
    assert.equal(d.falla, false);
  });

  it('entre 3,6 y 4 mA es incierta, no falla', () => {
    const d = diagnosticarValor(3.8, opciones);
    assert.equal(d.falla, false);
    assert.equal(d.calidad, 'uncertain');
  });

  it('el rango 4–20 mA es válido', () => {
    for (const ma of [4, 12, 20]) {
      assert.equal(diagnosticarValor(ma, opciones).calidad, 'good', `${ma} mA`);
    }
  });

  it('por encima de 20,5 mA es sobre-rango, no falla', () => {
    const d = diagnosticarValor(21, opciones);
    assert.equal(d.falla, false);
    assert.equal(d.calidad, 'uncertain');
  });

  it('sin marcar como corriente, no se aplican umbrales NAMUR', () => {
    // Un -5 de temperatura es raro, pero no es una falla de lazo.
    assert.equal(diagnosticarValor(-5).falla, false);
  });
});

describe('valores no numéricos', () => {
  it('null es falla', () => {
    const d = diagnosticarValor(null);
    assert.equal(d.falla, true);
    assert.equal(d.calidad, 'bad');
  });

  it('NaN es falla', () => {
    assert.equal(diagnosticarValor(Number.NaN).falla, true);
  });
});

describe('evaluarUmbral', () => {
  it('una medición en falla NO se evalúa contra umbrales', () => {
    assert.equal(evaluarUmbral('bad'), false);
  });

  it('una medición buena sí se evalúa', () => {
    assert.equal(evaluarUmbral('good'), true);
  });

  it('una incierta (sobre-rango) sí se evalúa: es una medida real', () => {
    assert.equal(evaluarUmbral('uncertain'), true);
  });

  it('sin calidad se asume buena', () => {
    assert.equal(evaluarUmbral(null), true);
  });
});
