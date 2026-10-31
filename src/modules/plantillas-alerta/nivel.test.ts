import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { clasificarNivel, describirBanda } from '../areas/cumplimiento.js';
import type { ReglaPlantilla } from './plantilla-alerta.service.js';

/**
 * Niveles de medición (bueno / advertencia / crítico).
 *
 * Regla central: una regla describe la CONDICIÓN DE ALARMA, así que el
 * valor es «bueno» cuando NINGUNA se dispara. Es la misma clasificación que
 * usan el panel y el motor de alertas.
 */

const banda = (
  severidad: 'warning' | 'critical',
  min: number,
  max: number
): ReglaPlantilla => ({
  variable: 'temperatura',
  tipos_variable: ['TEMPERATURA'],
  nombre: `Temperatura ${severidad}`,
  operador: 'fuera_de_rango',
  valor_min: min,
  valor_max: max,
  severidad,
});

describe('clasificarNivel · niveles básicos', () => {
  it('sin reglas devuelve sin_regla', () => {
    assert.equal(clasificarNivel(22, []), 'sin_regla');
  });

  it('sin valor devuelve sin_datos', () => {
    assert.equal(clasificarNivel(null, [banda('warning', 20, 24)]), 'sin_datos');
  });

  it('dentro de la banda es bueno', () => {
    assert.equal(clasificarNivel(22, [banda('warning', 20, 24)]), 'bueno');
  });

  it('fuera de la banda de advertencia es advertencia', () => {
    assert.equal(clasificarNivel(25, [banda('warning', 20, 24)]), 'advertencia');
  });
});

describe('clasificarNivel · bordes', () => {
  it('el valor justo en el límite cuenta como bueno', () => {
    const reglas = [banda('warning', 20, 24)];
    assert.equal(clasificarNivel(20, reglas), 'bueno');
    assert.equal(clasificarNivel(24, reglas), 'bueno');
  });

  it('un valor apenas fuera ya no es bueno', () => {
    const reglas = [banda('warning', 20, 24)];
    assert.equal(clasificarNivel(24.01, reglas), 'advertencia');
    assert.equal(clasificarNivel(19.99, reglas), 'advertencia');
  });
});

describe('clasificarNivel · la crítica manda', () => {
  const reglas = [banda('warning', 20, 24), banda('critical', 18, 26)];

  it('en la banda de advertencia solo se marca advertencia', () => {
    assert.equal(clasificarNivel(25, reglas), 'advertencia');
  });

  it('si también rompe la crítica, gana crítico', () => {
    assert.equal(clasificarNivel(27, reglas), 'critico');
    assert.equal(clasificarNivel(17, reglas), 'critico');
  });
});

describe('clasificarNivel · valores como texto (NUMERIC de PostgreSQL)', () => {
  /*
   * PostgreSQL devuelve NUMERIC como string al driver `pg`. Si no se
   * convierten, `"18" > "9"` compara alfabéticamente y da resultados
   * absurdos. Ya ocurrió una vez con la histéresis.
   */
  const reglasTexto: ReglaPlantilla[] = [
    {
      variable: 'presion',
      tipos_variable: ['PRESION'],
      nombre: 'Presión baja',
      operador: '<',
      valor_referencia_numerico: '2.5' as unknown as number,
      severidad: 'warning',
    },
  ];

  it('compara números aunque lleguen como texto', () => {
    assert.equal(clasificarNivel(3, reglasTexto), 'bueno');
    assert.equal(clasificarNivel(1, reglasTexto), 'advertencia');
  });
});

describe('describirBanda', () => {
  it('describe una banda cerrada', () => {
    const d = describirBanda(banda('warning', 20, 24));
    assert.equal(d.texto, '20 – 24');
    assert.equal(d.minimo, 20);
    assert.equal(d.maximo, 24);
  });

  it('describe un límite abierto', () => {
    const d = describirBanda({
      variable: 'co2',
      tipos_variable: ['CO2'],
      nombre: 'CO₂ alto',
      operador: '>',
      valor_referencia_numerico: 1000,
      severidad: 'warning',
    });
    assert.match(d.texto, /1000/);
  });
});
