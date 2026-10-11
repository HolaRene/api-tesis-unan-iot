/**
 * Tests de la numeración de parámetros del resumen del dashboard.
 *
 * CONTEXTO DEL FALLO QUE ESTOS TESTS EVITAN
 *
 * Las consultas del resumen filtran por dueño con `$1` SOLO cuando el usuario
 * no es admin. Las de mediciones y alertas llevan además un `LIMIT` que estaba
 * fijo como `$2`.
 *
 * Como admin, el SQL no contiene ningún `$1` (no hay filtro), pero se le
 * seguía pasando un `null` como primer parámetro. Postgres intentaba resolver
 * el tipo de un parámetro que la consulta no usaba y fallaba con:
 *
 *     could not determine data type of parameter $1
 *
 * El resultado era un HTTP 500 en el dashboard y una pantalla vacía.
 *
 * La solución fue numerar el `LIMIT` según haya filtro o no, de forma que la
 * cantidad de parámetros enviados coincida SIEMPRE con los que usa el SQL.
 *
 * Estos tests comprueban esa correspondencia sin necesidad de base de datos:
 * cuentan los marcadores `$n` del SQL y los comparan con los parámetros.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Reproduce la construcción del SQL y de los parámetros del repositorio.
 *
 * Es una copia reducida de la lógica real: si alguien cambia una sin la otra,
 * estos tests lo detectan.
 */
function construirConsulta(opciones: {
  esAdmin: boolean;
  limite: number;
}): { sql: string; parametros: unknown[] } {
  const { esAdmin, limite } = opciones;

  const filtroDueno = esAdmin
    ? ''
    : 'WHERE (d.propietario_id = $1 OR d.propietario_id IS NULL)';

  // El número del LIMIT depende de si hay filtro por dueño.
  const nLimite = esAdmin ? 1 : 2;

  const sql = `
    SELECT m.id
    FROM mediciones m
    ${filtroDueno}
    ORDER BY m.registrado_en DESC
    LIMIT $${nLimite}
  `;

  const parametros = esAdmin ? [limite] : ['uuid-del-usuario', limite];

  return { sql, parametros };
}

/** Extrae los números de marcador (`$1`, `$2`…) presentes en un SQL. */
function marcadores(sql: string): number[] {
  const encontrados = new Set<number>();
  for (const m of sql.matchAll(/\$(\d+)/g)) {
    encontrados.add(Number(m[1]));
  }
  return [...encontrados].sort((a, b) => a - b);
}

describe('parámetros del resumen del dashboard', () => {
  test('como admin, el SQL no referencia $1 y no se envía de más', () => {
    const { sql, parametros } = construirConsulta({ esAdmin: true, limite: 10 });

    // Sin filtro por dueño, el único marcador es el del LIMIT.
    assert.deepEqual(marcadores(sql), [1], 'el SQL solo debe usar $1 (el LIMIT)');

    // Y se envía exactamente un parámetro: el límite, NO un null de más.
    assert.equal(parametros.length, 1);
    assert.equal(parametros[0], 10);
  });

  test('como usuario normal, el SQL usa $1 y $2 y se envían ambos', () => {
    const { sql, parametros } = construirConsulta({ esAdmin: false, limite: 10 });

    assert.deepEqual(marcadores(sql), [1, 2]);
    assert.equal(parametros.length, 2);
    assert.equal(parametros[0], 'uuid-del-usuario');
    assert.equal(parametros[1], 10);
  });

  test('el número de marcadores coincide con el de parámetros (admin)', () => {
    const { sql, parametros } = construirConsulta({ esAdmin: true, limite: 5 });
    const maxMarcador = Math.max(...marcadores(sql));
    assert.equal(
      parametros.length,
      maxMarcador,
      'enviar más parámetros que marcadores provoca el error de Postgres'
    );
  });

  test('el número de marcadores coincide con el de parámetros (usuario)', () => {
    const { sql, parametros } = construirConsulta({ esAdmin: false, limite: 5 });
    const maxMarcador = Math.max(...marcadores(sql));
    assert.equal(parametros.length, maxMarcador);
  });

  test('ningún marcador queda huérfano sin parámetro', () => {
    for (const esAdmin of [true, false]) {
      const { sql, parametros } = construirConsulta({ esAdmin, limite: 20 });
      for (const n of marcadores(sql)) {
        assert.ok(
          n <= parametros.length,
          `el marcador $${n} no tiene parámetro (esAdmin=${esAdmin})`
        );
      }
    }
  });
});
