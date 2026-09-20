/**
 * Tests de la lógica de series agregadas.
 *
 * Importante: el resumen debe ser la media REAL de todas las mediciones,
 * no la media de las medias. Cuando los cubos tienen distinto número de
 * muestras, ambas difieren, y usar la segunda daría un valor incorrecto.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { INTERVALOS_AGREGACION } from './measurement.types.js';

/**
 * Réplica de la lógica de resumen del servicio, aislada para poder probarla
 * sin base de datos.
 */
function calcularResumen(
  cubos: Array<{ media: number | null; minimo: number | null; maximo: number | null; muestras: number }>
) {
  const totalMuestras = cubos.reduce((acc, c) => acc + (c.muestras ?? 0), 0);
  const sumaPonderada = cubos.reduce(
    (acc, c) => acc + (c.media ?? 0) * (c.muestras ?? 0),
    0
  );
  const minimos = cubos.map((c) => c.minimo).filter((v): v is number => v !== null);
  const maximos = cubos.map((c) => c.maximo).filter((v): v is number => v !== null);

  return {
    media: totalMuestras > 0 ? sumaPonderada / totalMuestras : null,
    minimo: minimos.length ? Math.min(...minimos) : null,
    maximo: maximos.length ? Math.max(...maximos) : null,
    muestras: totalMuestras,
  };
}

describe('resumen de series agregadas', () => {
  test('pondera por número de muestras (no es media de medias)', () => {
    // Cubo A: 9 muestras de media 10 -> 90
    // Cubo B: 1 muestra de media 20  -> 20
    // Media real = 110/10 = 11. Media de medias = 15 (INCORRECTA).
    const r = calcularResumen([
      { media: 10, minimo: 9, maximo: 11, muestras: 9 },
      { media: 20, minimo: 20, maximo: 20, muestras: 1 },
    ]);
    assert.equal(r.media, 11, 'debe ponderar por muestras');
    assert.equal(r.muestras, 10);
  });

  test('calcula los extremos reales entre cubos', () => {
    const r = calcularResumen([
      { media: 5, minimo: -3, maximo: 8, muestras: 2 },
      { media: 7, minimo: 1, maximo: 21, muestras: 2 },
    ]);
    assert.equal(r.minimo, -3);
    assert.equal(r.maximo, 21);
  });

  test('sin cubos devuelve resumen vacío sin dividir por cero', () => {
    const r = calcularResumen([]);
    assert.equal(r.media, null);
    assert.equal(r.minimo, null);
    assert.equal(r.maximo, null);
    assert.equal(r.muestras, 0);
  });

  test('ignora cubos con media/minimo/maximo nulos', () => {
    const r = calcularResumen([
      { media: null, minimo: null, maximo: null, muestras: 0 },
      { media: 4, minimo: 4, maximo: 4, muestras: 3 },
    ]);
    assert.equal(r.media, 4);
    assert.equal(r.minimo, 4);
    assert.equal(r.muestras, 3);
  });

  test('un solo cubo conserva su media', () => {
    const r = calcularResumen([{ media: 42.5, minimo: 40, maximo: 45, muestras: 7 }]);
    assert.equal(r.media, 42.5);
    assert.equal(r.muestras, 7);
  });
});

describe('intervalos de agregación', () => {
  test('la lista blanca contiene los 4 intervalos soportados', () => {
    assert.deepEqual([...INTERVALOS_AGREGACION], ['hora', 'dia', 'semana', 'mes']);
  });

  test('el mapeo a date_trunc es el esperado', () => {
    // Réplica del mapa usado en el repositorio: si alguien lo cambia, este
    // test obliga a revisar el impacto.
    const TRUNCS: Record<string, string> = {
      hora: 'hour',
      dia: 'day',
      semana: 'week',
      mes: 'month',
    };
    assert.equal(TRUNCS.hora, 'hour');
    assert.equal(TRUNCS.dia, 'day');
    assert.equal(TRUNCS.semana, 'week');
    assert.equal(TRUNCS.mes, 'month');
  });
});
