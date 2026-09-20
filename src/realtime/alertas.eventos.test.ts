/**
 * Tests de los emisores realtime de alertas.
 *
 * Verifican la regla anti-duplicación:
 *   - `alerta:resuelta` se emite SOLO si el estado es `resolved`.
 *   - Un cambio a `acknowledged` emite `alerta:actualizada`, nunca "resuelta".
 *   - Se emite UN solo evento por cambio (nunca los dos).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  emitirAlertaCreada,
  emitirAlertaResuelta,
  emitirCambioDeAlerta,
  tipoEventoDeAlerta,
} from './alertas.eventos.js';
import type { Alert } from '../modules/alerts/alert.types.js';

function alerta(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alerta-1',
    sensor_id: null,
    canal_id: 'canal-1',
    regla_id: 'regla-1',
    medicion_id: 10,
    tipo: 'regla',
    severidad: 'critical',
    mensaje: "Regla 'Temperatura alta' cumplida",
    estado: 'active',
    iniciada_en: new Date('2026-09-12T02:00:00.000Z'),
    reconocida_en: null,
    finalizada_en: null,
    metadatos: {},
    ...overrides,
  };
}

describe('emisores realtime de alertas', () => {
  test('tipoEventoDeAlerta: active → alerta:actualizada', () => {
    assert.equal(tipoEventoDeAlerta({ estado: 'active' }), 'alerta:actualizada');
  });

  test('tipoEventoDeAlerta: acknowledged → alerta:actualizada', () => {
    assert.equal(
      tipoEventoDeAlerta({ estado: 'acknowledged' }),
      'alerta:actualizada'
    );
  });

  test('tipoEventoDeAlerta: resolved → alerta:resuelta', () => {
    assert.equal(tipoEventoDeAlerta({ estado: 'resolved' }), 'alerta:resuelta');
  });

  test('emitirAlertaResuelta: NO emite si la alerta no está resuelta', () => {
    assert.equal(emitirAlertaResuelta(alerta({ estado: 'active' })), false);
    assert.equal(emitirAlertaResuelta(alerta({ estado: 'acknowledged' })), false);
  });

  test('emitirAlertaResuelta: emite cuando está resuelta', () => {
    assert.equal(emitirAlertaResuelta(alerta({ estado: 'resolved' })), true);
  });

  test('emitirAlertaCreada: siempre emite', () => {
    assert.equal(emitirAlertaCreada(alerta()), true);
  });

  test('emitirCambioDeAlerta: reconocer emite actualizada (no resuelta)', () => {
    // La decisión pura es la que evita duplicar en el cliente.
    assert.equal(
      tipoEventoDeAlerta(alerta({ estado: 'acknowledged' })),
      'alerta:actualizada'
    );
    assert.equal(emitirCambioDeAlerta(alerta({ estado: 'acknowledged' })), true);
  });

  test('emitirCambioDeAlerta: resolver emite UN evento (resuelta)', () => {
    assert.equal(emitirCambioDeAlerta(alerta({ estado: 'resolved' })), true);
  });
});
