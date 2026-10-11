/**
 * Tests del esquema de sensores.
 *
 * CONTEXTO DEL FALLO QUE ESTOS TESTS EVITAN
 *
 * El `codigo` del sensor pasó a generarlo el servidor a partir del nombre
 * (ver `docs/identificadores-automaticos.md`). El formulario dejó de enviarlo,
 * pero el esquema de Zod seguía exigiéndolo:
 *
 *   POST /sensors  →  400
 *   {"campo":"codigo","mensaje":"Invalid input: expected string, received undefined"}
 *
 * Un error que no explica nada al usuario, porque el campo ni siquiera
 * aparece en el formulario: no hay nada que pueda rellenar.
 *
 * Estos tests fijan el contrato: `codigo` debe ser OPCIONAL al crear.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { crearSensorSchema } from './sensor.schema.js';

/*
 * UUID v4 válido. Zod comprueba la VERSIÓN (tercer grupo, 1-5) y la
 * VARIANTE (cuarto grupo, 8-b), así que un valor con el formato correcto pero
 * con esos dígitos mal puestos se rechaza con «No es un id válido».
 */
const UUID = '11111111-2222-4333-8444-555555555555';

/** Payload mínimo que envía el frontend actual: sin `codigo`. */
const payloadSinCodigo = {
  nombre: 'DHT Quirófano',
  dispositivo_id: UUID,
  tipo_variable_id: UUID,
};

describe('crearSensorSchema', () => {
  test('acepta un sensor SIN codigo (lo genera el servidor)', () => {
    const r = crearSensorSchema.parse(payloadSinCodigo);
    assert.equal(r.nombre, 'DHT Quirófano');
    assert.equal(r.codigo, undefined);
  });

  test('acepta un sensor CON codigo (clientes antiguos)', () => {
    // No se rechaza para no romper versiones anteriores del frontend; el
    // servicio lo descartará y usará el suyo.
    const r = crearSensorSchema.parse({ ...payloadSinCodigo, codigo: 'DHT1W' });
    assert.equal(r.codigo, 'DHT1W');
  });

  test('sigue exigiendo el nombre', () => {
    assert.throws(() => crearSensorSchema.parse({ dispositivo_id: UUID }));
  });

  test('rechaza un nombre vacío', () => {
    assert.throws(() => crearSensorSchema.parse({ ...payloadSinCodigo, nombre: '' }));
  });

  test('acepta las magnitudes (canales) sin codigo', () => {
    const r = crearSensorSchema.parse({
      ...payloadSinCodigo,
      canales: [
        { tipo_variable_id: UUID },
        { tipo_variable_id: UUID, unidad: '%' },
      ],
    });
    assert.equal(r.canales?.length, 2);
    assert.equal(r.canales?.[0].codigo, undefined);
  });

  test('un codigo demasiado largo sí se rechaza', () => {
    // Debe seguir habiendo un límite, aunque el campo sea opcional.
    assert.throws(() =>
      crearSensorSchema.parse({ ...payloadSinCodigo, codigo: 'x'.repeat(101) })
    );
  });
});
