import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { crearReglaSchema, actualizarReglaSchema } from './regla-alerta.schema.js';

/**
 * UUID válido (versión 4 y variante RFC): Zod valida ambas partes.
 */
const CANAL_ID = '11111111-2222-4333-8444-555555555555';

const base = {
  canal_id: CANAL_ID,
  nombre: 'Temperatura alta',
  operador: '>',
  valor_referencia_numerico: 30,
  severidad: 'warning' as const,
};

/**
 * Regresión: los rangos invertidos se guardaban sin error.
 *
 * Una regla `entre 60 y 40` es imposible de cumplir. No daba ningún aviso y
 * aparecía como configurada en la interfaz, pero **nunca disparaba**.
 *
 * Es un fallo silencioso: el usuario cree que está protegido y no lo está.
 */
describe('rangos de alerta', () => {
  it('acepta un rango bien formado', () => {
    const r = crearReglaSchema.safeParse({
      ...base,
      operador: 'entre',
      valor_referencia_numerico: undefined,
      valor_min: 40,
      valor_max: 60,
    });
    assert.equal(r.success, true);
  });

  it('rechaza un rango invertido (min > max)', () => {
    const r = crearReglaSchema.safeParse({
      ...base,
      operador: 'entre',
      valor_min: 60,
      valor_max: 40,
    });
    assert.equal(r.success, false);
    if (!r.success) {
      const mensaje = r.error.issues.map((i) => i.message).join(' ');
      assert.match(mensaje, /mínimo no puede ser mayor/);
    }
  });

  it('rechaza un rango invertido también en fuera_de_rango', () => {
    const r = crearReglaSchema.safeParse({
      ...base,
      operador: 'fuera_de_rango',
      valor_min: 60,
      valor_max: 40,
    });
    assert.equal(r.success, false);
  });

  it('acepta el caso límite min === max', () => {
    const r = crearReglaSchema.safeParse({
      ...base,
      operador: 'entre',
      valor_min: 50,
      valor_max: 50,
    });
    assert.equal(r.success, true);
  });

  it('rechaza un rango sin uno de sus extremos', () => {
    const r = crearReglaSchema.safeParse({
      ...base,
      operador: 'entre',
      valor_min: 40,
    });
    assert.equal(r.success, false);
    if (!r.success) {
      assert.match(r.error.issues[0]!.message, /mínimo y un valor máximo/);
    }
  });

  it('no exige rango a los operadores simples', () => {
    const r = crearReglaSchema.safeParse({ ...base, operador: '>', valor_min: null, valor_max: null });
    assert.equal(r.success, true);
  });

  it('en actualización parcial de un solo extremo no falla', () => {
    // Falta `valor_max`, pero no hay información suficiente para concluir que
    // el rango es inválido: se validará en el servicio con los datos fusionados.
    const r = actualizarReglaSchema.safeParse({ valor_min: 10 });
    assert.equal(r.success, true);
  });

  it('en actualización con ambos extremos sí valida', () => {
    const r = actualizarReglaSchema.safeParse({ valor_min: 60, valor_max: 40 });
    assert.equal(r.success, false);
  });
});
