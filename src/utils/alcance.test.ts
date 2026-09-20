/**
 * Tests del helper de alcance (aislamiento de datos por usuario).
 *
 * Cubren las reglas clave:
 *   - admin      → sin filtro (ve todo).
 *   - usuario    → solo lo suyo + lo global.
 *   - undefined  → sin filtro (uso interno: IoT, watchdog).
 *   - null       → sin visibilidad (defensivo).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  condicionPropiedad,
  condicionVisibilidad,
  esAlcanceTotal,
  puedeModificar,
  puedeVer,
  UsuarioAlcance,
} from './alcance.js';

const ADMIN: UsuarioAlcance = { id: 'admin-1', rol: 'admin' };
const USUARIO: UsuarioAlcance = { id: 'user-1', rol: 'usuario' };
const VIEWER: UsuarioAlcance = { id: 'viewer-1', rol: 'viewer' };

describe('alcance de datos por usuario', () => {
  test('esAlcanceTotal: solo el admin ve todo', () => {
    assert.equal(esAlcanceTotal(ADMIN), true);
    assert.equal(esAlcanceTotal(USUARIO), false);
    assert.equal(esAlcanceTotal(VIEWER), false);
    assert.equal(esAlcanceTotal(undefined), false);
  });

  test('condicionVisibilidad: admin no lleva filtro', () => {
    assert.equal(condicionVisibilidad('a', 1, ADMIN), null);
  });

  test('condicionVisibilidad: sin usuario (uso interno) no lleva filtro', () => {
    assert.equal(condicionVisibilidad('a', 1, undefined), null);
  });

  test('condicionVisibilidad: usuario lleva filtro por id + globales', () => {
    const cond = condicionVisibilidad('a', 1, USUARIO);
    assert.ok(cond);
    assert.match(cond.sql, /propietario_id = \$1/);
    assert.match(cond.sql, /IS NULL/);
    assert.equal(cond.valor, 'user-1');
  });

  test('condicionVisibilidad: null explícito no coincide con nada', () => {
    const cond = condicionVisibilidad('a', 1, null);
    assert.ok(cond);
    assert.equal(cond.sql, 'FALSE');
  });

  test('condicionPropiedad: admin sin restricción', () => {
    assert.equal(condicionPropiedad('a', 1, ADMIN), null);
  });

  test('condicionPropiedad: usuario solo su id (sin globales)', () => {
    const cond = condicionPropiedad('a', 2, USUARIO);
    assert.ok(cond);
    assert.equal(cond.sql, 'a.propietario_id = $2');
    // No debe permitir tocar recursos globales.
    assert.doesNotMatch(cond.sql, /IS NULL/);
  });

  test('puedeVer: lo global lo ve cualquier usuario autenticado', () => {
    assert.equal(puedeVer(null, USUARIO), true);
    assert.equal(puedeVer(undefined, VIEWER), true);
  });

  test('puedeVer: lo ajeno no se ve, lo propio sí', () => {
    assert.equal(puedeVer('otro-id', USUARIO), false);
    assert.equal(puedeVer('user-1', USUARIO), true);
  });

  test('puedeVer: el admin lo ve todo', () => {
    assert.equal(puedeVer('cualquiera', ADMIN), true);
  });

  test('puedeModificar: lo global NO lo toca un usuario normal', () => {
    assert.equal(puedeModificar(null, USUARIO), false);
    assert.equal(puedeModificar(null, ADMIN), true);
  });

  test('puedeModificar: solo el dueño o el admin', () => {
    assert.equal(puedeModificar('user-1', USUARIO), true);
    assert.equal(puedeModificar('otro-id', USUARIO), false);
    assert.equal(puedeModificar('otro-id', ADMIN), true);
  });

  test('puedeVer/puedeModificar sin usuario: deniegan', () => {
    assert.equal(puedeVer('x', undefined), false);
    assert.equal(puedeModificar('x', undefined), false);
  });
});
