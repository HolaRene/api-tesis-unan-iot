/**
 * Tests del esquema de actuadores.
 *
 * CONTEXTO
 *
 * El `codigo` del actuador pasó a generarlo el servidor a partir del tipo y
 * el nombre (ver `docs/identificadores-automaticos.md`). El formulario dejó
 * de enviarlo, y el esquema debe aceptarlo como opcional.
 *
 * Exigirlo produce un 400 con «expected string, received undefined» en un
 * campo que el usuario ni siquiera ve: no hay nada que pueda rellenar.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { crearActuadorSchema } from './actuador.schema.js';

/** UUID v4 válido: Zod comprueba versión y variante, no solo el formato. */
const UUID = '11111111-2222-4333-8444-555555555555';

/** Payload mínimo real: sin `codigo`. */
const payloadSinCodigo = {
  dispositivo_id: UUID,
  nombre: 'Buzzer Quirófano',
  tipo: 'buzzer',
};

describe('crearActuadorSchema', () => {
  test('acepta un actuador SIN codigo (lo genera el servidor)', () => {
    const r = crearActuadorSchema.parse(payloadSinCodigo);
    assert.equal(r.nombre, 'Buzzer Quirófano');
    assert.equal(r.tipo, 'buzzer');
    assert.equal(r.codigo, undefined);
  });

  test('acepta un actuador CON codigo (clientes antiguos)', () => {
    // No se rechaza para no romper versiones anteriores del frontend; el
    // servicio lo descartará y usará el suyo.
    const r = crearActuadorSchema.parse({ ...payloadSinCodigo, codigo: 'RELE-1' });
    assert.equal(r.codigo, 'RELE-1');
  });

  test('sigue exigiendo el nombre', () => {
    assert.throws(() =>
      crearActuadorSchema.parse({ dispositivo_id: UUID, tipo: 'rele' })
    );
  });

  test('sigue exigiendo el tipo', () => {
    // El tipo forma parte del código generado, así que es obligatorio.
    assert.throws(() =>
      crearActuadorSchema.parse({ dispositivo_id: UUID, nombre: 'Relé 1' })
    );
  });

  test('sigue exigiendo el dispositivo', () => {
    assert.throws(() =>
      crearActuadorSchema.parse({ nombre: 'Relé 1', tipo: 'rele' })
    );
  });

  test('un codigo demasiado largo sí se rechaza', () => {
    assert.throws(() =>
      crearActuadorSchema.parse({ ...payloadSinCodigo, codigo: 'x'.repeat(101) })
    );
  });
});
