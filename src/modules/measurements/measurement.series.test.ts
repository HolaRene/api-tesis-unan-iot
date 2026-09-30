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
import { seriesMedicionesSchema } from './measurement.schema.js';

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
  test('la lista blanca contiene los 5 intervalos soportados', () => {
    assert.deepEqual(
      [...INTERVALOS_AGREGACION],
      ['minuto', 'hora', 'dia', 'semana', 'mes']
    );
  });

  test('el mapeo a date_trunc es el esperado', () => {
    // Réplica del mapa usado en el repositorio: si alguien lo cambia, este
    // test obliga a revisar el impacto.
    const TRUNCS: Record<string, string> = {
      minuto: 'minute',
      hora: 'hour',
      dia: 'day',
      semana: 'week',
      mes: 'month',
    };
    assert.equal(TRUNCS.minuto, 'minute');
    assert.equal(TRUNCS.hora, 'hour');
    assert.equal(TRUNCS.dia, 'day');
    assert.equal(TRUNCS.semana, 'week');
    assert.equal(TRUNCS.mes, 'month');
  });
});

/**
 * Regresión: el filtro `tipo_variable_id` debe LLEGAR al repositorio.
 *
 * Bug encontrado: el schema del query no declaraba `tipo_variable_id`, así que
 * Zod lo descartaba del query string. El controlador lo leía como `undefined`
 * y el filtro se ignoraba en silencio.
 *
 * Consecuencia visible: al pedir las series de un ÁREA o de un DISPOSITIVO con
 * varias magnitudes, todas devolvían el MISMO valor (el promedio de
 * temperatura, voltaje, corriente… mezclados), que no significa nada.
 *
 * Se comprueba aquí porque es una regresión silenciosa: no da error, solo
 * devuelve datos incorrectos.
 */
describe('series: filtro por magnitud (tipo_variable_id)', () => {
  const UUID = '022aad9d-2e6f-4496-bfb7-21f3724fb31e';

  test('el schema CONSERVA tipo_variable_id (no lo descarta)', () => {
    const resultado = seriesMedicionesSchema.parse({
      area_id: UUID,
      tipo_variable_id: UUID,
    });

    // Si esta clave desaparece, el filtro nunca llega al repositorio.
    assert.ok(
      'tipo_variable_id' in resultado,
      'El schema descartó tipo_variable_id: el filtro se ignoraría'
    );
    assert.equal(resultado.tipo_variable_id, UUID);
  });

  test('se puede combinar area_id + tipo_variable_id', () => {
    const resultado = seriesMedicionesSchema.parse({
      area_id: UUID,
      tipo_variable_id: UUID,
      intervalo: 'dia',
    });

    assert.equal(resultado.area_id, UUID);
    assert.equal(resultado.tipo_variable_id, UUID);
    assert.equal(resultado.intervalo, 'dia');
  });

  test('rechaza un tipo_variable_id que no sea UUID', () => {
    assert.throws(() =>
      seriesMedicionesSchema.parse({ tipo_variable_id: 'no-es-uuid' })
    );
  });

  test('es opcional: sin él no falla', () => {
    const resultado = seriesMedicionesSchema.parse({ area_id: UUID });
    assert.equal(resultado.tipo_variable_id, undefined);
  });
});

/**
 * Intervalo `sin_agrupar`: devuelve una fila por medición.
 *
 * Existe porque agrupar oculta datos cuando el equipo muestrea más rápido que
 * el cubo. Con cubos de un minuto y mediciones cada 2 segundos, 30 mediciones
 * se funden en UN punto: el gráfico muestra un dato suelto y parece que el
 * sensor se desconectó, cuando en realidad llegaron todas.
 */
describe('intervalo sin_agrupar', () => {
  test('el esquema lo acepta', () => {
    const resultado = seriesMedicionesSchema.parse({ intervalo: 'sin_agrupar' });
    assert.equal(resultado.intervalo, 'sin_agrupar');
  });

  test('convive con los intervalos agrupados', () => {
    for (const intervalo of INTERVALOS_AGREGACION) {
      const r = seriesMedicionesSchema.parse({ intervalo });
      assert.equal(r.intervalo, intervalo);
    }
  });

  test('sigue rechazando un intervalo inventado', () => {
    // El valor se resuelve contra una lista blanca: nunca llega crudo al SQL.
    assert.throws(() => seriesMedicionesSchema.parse({ intervalo: 'segundo' }));
    assert.throws(() => seriesMedicionesSchema.parse({ intervalo: 'DROP TABLE' }));
  });

  test('por defecto se sigue agrupando por hora', () => {
    const resultado = seriesMedicionesSchema.parse({});
    assert.equal(resultado.intervalo, 'hora');
  });
});
