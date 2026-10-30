import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularCumplimiento,
  clasificarNivel,
  dentroDeBanda,
  describirBanda,
} from './cumplimiento.js';
import type { PlantillaAlerta } from '../plantillas-alerta/plantilla-alerta.service.js';

/**
 * Cumplimiento normativo.
 *
 * Responde a «¿se está cumpliendo la norma ahora?» comparando el último
 * valor con la banda del perfil del área.
 */

const quirofano: PlantillaAlerta = {
  id: 'quirofano-ashrae-170',
  nombre: 'Quirófano',
  descripcion: '…',
  norma: 'ASHRAE 170',
  notas: [],
  reglas: [
    {
      variable: 'temperatura',
      tipos_variable: ['TEMPERATURA'],
      nombre: 'Temperatura fuera de rango',
      operador: 'fuera_de_rango',
      valor_min: 20,
      valor_max: 24,
      severidad: 'warning',
      mensaje: 'Temperatura fuera de 20 a 24 °C',
    },
    {
      variable: 'presion',
      tipos_variable: ['PRESION'],
      nombre: 'Presión mínima',
      operador: '<',
      valor_referencia_numerico: 2.5,
      severidad: 'warning',
      mensaje: 'Presión positiva por debajo de 2,5 Pa [verificar]',
    },
  ],
};

const magnitudes = [
  { codigo: 'TEMPERATURA', nombre: 'Temperatura', unidad: '°C' },
  { codigo: 'PRESION', nombre: 'Presión', unidad: 'Pa' },
  { codigo: 'CO2', nombre: 'CO2', unidad: 'ppm' },
];

describe('dentroDeBanda', () => {
  it('banda cerrada: los extremos cuentan como dentro', () => {
    assert.equal(dentroDeBanda(20, 20, 24), true);
    assert.equal(dentroDeBanda(24, 20, 24), true);
    assert.equal(dentroDeBanda(22, 20, 24), true);
  });

  it('banda cerrada: fuera por ambos lados', () => {
    assert.equal(dentroDeBanda(19.9, 20, 24), false);
    assert.equal(dentroDeBanda(24.1, 20, 24), false);
  });

  it('límite abierto: solo importa el mínimo', () => {
    assert.equal(dentroDeBanda(2.5, 2.5, null), true);
    assert.equal(dentroDeBanda(2.4, 2.5, null), false);
  });
});

describe('describirBanda', () => {
  it('describe una banda cerrada', () => {
    const b = describirBanda(quirofano.reglas[0]!);
    assert.equal(b.texto, '20 – 24');
    assert.equal(b.minimo, 20);
    assert.equal(b.maximo, 24);
  });

  it('describe un límite abierto', () => {
    const b = describirBanda(quirofano.reglas[1]!);
    assert.equal(b.texto, '≥ 2.5');
    assert.equal(b.maximo, null);
  });
});

describe('calcularCumplimiento', () => {
  const ultimos = new Map([
    ['TEMPERATURA', { valor: 23.4, medido_en: new Date() }],
    ['PRESION', { valor: 1.2, medido_en: new Date() }],
  ]);

  it('marca cumple, fuera y sin datos', () => {
    const r = calcularCumplimiento(quirofano, magnitudes, ultimos);
    const porCodigo = new Map(r.map((m) => [m.tipo_codigo, m]));

    assert.equal(porCodigo.get('TEMPERATURA')!.estado, 'cumple');
    assert.equal(porCodigo.get('PRESION')!.estado, 'fuera');
    assert.equal(porCodigo.get('CO2')!.estado, 'sin_regla');
  });

  it('sin perfil declarado, todo queda sin_regla', () => {
    const r = calcularCumplimiento(null, magnitudes, ultimos);
    assert.equal(r.every((m) => m.estado === 'sin_regla'), true);
  });

  it('una magnitud sin mediciones queda sin_datos', () => {
    const r = calcularCumplimiento(
      quirofano,
      [{ codigo: 'TEMPERATURA', nombre: 'Temperatura', unidad: '°C' }],
      new Map()
    );
    assert.equal(r[0]!.estado, 'sin_datos');
  });

  it('propaga la marca [verificar] de la regla', () => {
    const r = calcularCumplimiento(quirofano, magnitudes, ultimos);
    const presion = r.find((m) => m.tipo_codigo === 'PRESION')!;
    assert.equal(presion.requiere_verificacion, true);
  });

  it('la temperatura no lleva marca', () => {
    const r = calcularCumplimiento(quirofano, magnitudes, ultimos);
    const temp = r.find((m) => m.tipo_codigo === 'TEMPERATURA')!;
    assert.equal(temp.requiere_verificacion, false);
  });
});

describe('clasificarNivel', () => {
  const reglas = [
    { variable: 't', tipos_variable: ['TEMPERATURA'], nombre: 'w', operador: 'fuera_de_rango', valor_min: 20, valor_max: 24, severidad: 'warning', mensaje: '' },
    { variable: 't', tipos_variable: ['TEMPERATURA'], nombre: 'c', operador: 'fuera_de_rango', valor_min: 18, valor_max: 26, severidad: 'critical', mensaje: '' },
  ] as never;

  it('bueno dentro de la banda', () => assert.equal(clasificarNivel(22, reglas), 'bueno'));
  it('advertencia entre la banda y el margen crítico', () => {
    assert.equal(clasificarNivel(19, reglas), 'advertencia');
    assert.equal(clasificarNivel(25, reglas), 'advertencia');
  });
  it('crítico fuera del margen', () => {
    assert.equal(clasificarNivel(17, reglas), 'critico');
    assert.equal(clasificarNivel(27, reglas), 'critico');
  });
  it('sin datos y sin regla', () => {
    assert.equal(clasificarNivel(null, reglas), 'sin_datos');
    assert.equal(clasificarNivel(22, [] as never), 'sin_regla');
  });
  it('una presión de 5 Pa NO es alarma con la regla «< 2,5»', () => {
    const p = [{ variable: 'p', tipos_variable: ['PRESION'], nombre: 'p', operador: '<', valor_referencia_numerico: 2.5, severidad: 'warning', mensaje: '' }] as never;
    assert.equal(clasificarNivel(5, p), 'bueno');
    assert.equal(clasificarNivel(1.2, p), 'advertencia');
  });
});
