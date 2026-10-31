import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clasificarNivel,
  cumpleRegla,
  type ReglaNivel,
} from './nivel.js';

/**
 * Nivel de medición calculado al leer.
 *
 * Estos tests cubren lo que la clasificación debe garantizar antes de que
 * el nivel salga por la API o por el WebSocket.
 */

const regla = (
  severidad: 'warning' | 'critical',
  operador: string,
  valores: Partial<ReglaNivel>
): ReglaNivel => ({
  operador,
  severidad,
  ...valores,
});

describe('cumpleRegla · operadores', () => {
  it('«>» se dispara por encima', () => {
    const r = regla('warning', '>', { valor_referencia_numerico: 1000 });
    assert.equal(cumpleRegla(r, 1001), true);
    assert.equal(cumpleRegla(r, 1000), false);
  });

  it('«<» se dispara por debajo', () => {
    const r = regla('warning', '<', { valor_referencia_numerico: 2.5 });
    assert.equal(cumpleRegla(r, 2), true);
    assert.equal(cumpleRegla(r, 3), false);
  });

  it('«fuera_de_rango» avisa al salir de la banda', () => {
    const r = regla('warning', 'fuera_de_rango', { valor_min: 20, valor_max: 24 });
    assert.equal(cumpleRegla(r, 19), true);
    assert.equal(cumpleRegla(r, 25), true);
    assert.equal(cumpleRegla(r, 22), false);
  });

  it('«entre» avisa DENTRO (es el operador original del proyecto)', () => {
    const r = regla('warning', 'entre', { valor_min: 20, valor_max: 24 });
    assert.equal(cumpleRegla(r, 22), true);
    assert.equal(cumpleRegla(r, 30), false);
  });

  it('ignora una regla sin valores numéricos', () => {
    const r = regla('warning', '>', {});
    assert.equal(cumpleRegla(r, 999), false);
  });
});

describe('clasificarNivel · calidad del sensor', () => {
  it('calidad bad devuelve falla aunque el valor sea normal', () => {
    const reglas = [regla('warning', 'fuera_de_rango', { valor_min: 20, valor_max: 24 })];
    // -32768 es el centinela de falla del PLC: NO es «crítico», es avería.
    assert.equal(clasificarNivel(-32768, reglas, 'bad'), 'falla');
    assert.equal(clasificarNivel(22, reglas, 'bad'), 'falla');
  });

  it('sin calidad se asume buena', () => {
    assert.equal(clasificarNivel(22, [], null), 'sin_regla');
  });
});

describe('clasificarNivel · valores NUMERIC como texto', () => {
  /*
   * PostgreSQL devuelve NUMERIC como string al driver `pg`. Sin convertir,
   * `"18" > "9"` compara alfabéticamente y da resultados absurdos. Ya
   * provocó un fallo en la histéresis de las alertas.
   */
  it('compara bien aunque los umbrales lleguen como texto', () => {
    const r = regla('warning', '>', { valor_referencia_numerico: '9' as unknown as number });
    assert.equal(cumpleRegla(r, 10), true);
    assert.equal(cumpleRegla(r, 5), false);
  });

  it('una banda con min y max como texto funciona', () => {
    const r = regla('warning', 'fuera_de_rango', {
      valor_min: '20' as unknown as number,
      valor_max: '24' as unknown as number,
    });
    assert.equal(cumpleRegla(r, 25), true);
    assert.equal(cumpleRegla(r, 22), false);
  });
});

describe('clasificarNivel · prioridad', () => {
  it('la crítica gana sobre la advertencia', () => {
    const reglas = [
      regla('warning', '>', { valor_referencia_numerico: 24 }),
      regla('critical', '>', { valor_referencia_numerico: 26 }),
    ];
    assert.equal(clasificarNivel(25, reglas, 'good'), 'advertencia');
    assert.equal(clasificarNivel(27, reglas, 'good'), 'critico');
  });

  it('sin reglas prevalece sobre sin_datos', () => {
    // Un canal sin reglas no puede clasificarse aunque no haya valor.
    assert.equal(clasificarNivel(null, [], 'good'), 'sin_regla');
  });
});
