import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  comandoPediaEstado,
  respuestaReconciliada,
  seleccionarReconciliable,
  VENTANA_RECONCILIACION_MIN,
  type ComandoReconciliable,
} from './reconciliacion.js';

/**
 * Reconciliación por estado reportado.
 *
 * Une dos órdenes de la misma tarea:
 *
 *   1. Si el valor LEÍDO coincide aunque la ESCRITURA reportó error, hay
 *      que darlo por bueno y guardar el error en `advertencia` (sin
 *      ocultarlo).
 *   2. Si el actuador reporta el estado pedido, un comando `fallido` se
 *      pasa a `ejecutado` con `confirmado_por = "estado_reportado"`.
 */

const comando = (
  parcial: Partial<ComandoReconciliable> = {}
): ComandoReconciliable => ({
  id: 'cmd-1',
  actuador_id: 'act-1',
  comando: 'ON',
  estado: 'fallido',
  respuesta: null,
  metadatos: null,
  ...parcial,
});

describe('comandoPediaEstado', () => {
  it('reconoce ON contra on/encendido/abierto', () => {
    for (const estado of ['on', 'encendido', 'abierto', 'activo']) {
      assert.equal(comandoPediaEstado('ON', estado), true, estado);
    }
  });

  it('reconoce OFF contra off/apagado/cerrado', () => {
    for (const estado of ['off', 'apagado', 'cerrado']) {
      assert.equal(comandoPediaEstado('OFF', estado), true, estado);
    }
  });

  it('no confunde ON con un estado apagado', () => {
    assert.equal(comandoPediaEstado('ON', 'off'), false);
    assert.equal(comandoPediaEstado('OFF', 'encendido'), false);
  });

  it('no distingue mayúsculas ni espacios', () => {
    assert.equal(comandoPediaEstado('  on  ', 'ON'), true);
  });

  it('compara directo un comando que no es encendido/apagado', () => {
    assert.equal(comandoPediaEstado('SETPOINT', 'setpoint'), true);
    assert.equal(comandoPediaEstado('SETPOINT', 'on'), false);
  });
});

describe('seleccionarReconciliable', () => {
  it('toma el más reciente que encaje', () => {
    const r = seleccionarReconciliable(
      [comando({ id: 'reciente', estado: 'fallido' }), comando({ id: 'viejo', estado: 'fallido' })],
      'on'
    );
    assert.equal(r?.id, 'reciente');
  });

  it('NO reconcilia los tres ON fallidos: solo uno', () => {
    /*
     * Si hubo tres ON fallidos, el equipo encendido explica como mucho el
     * último. Marcar los tres inventaría un historial que no ocurrió.
     */
    const r = seleccionarReconciliable(
      [
        comando({ id: 'a', estado: 'fallido' }),
        comando({ id: 'b', estado: 'fallido' }),
        comando({ id: 'c', estado: 'fallido' }),
      ],
      'on'
    );
    assert.equal(r?.id, 'a');
    // La función devuelve UNO, no una lista.
    assert.equal(Array.isArray(r), false);
  });

  it('toma un enviado si no hay nada más reciente', () => {
    const r = seleccionarReconciliable([comando({ estado: 'enviado' })], 'on');
    assert.notEqual(r, null);
  });

  it('NO toca un comando ya ejecutado', () => {
    assert.equal(seleccionarReconciliable([comando({ estado: 'ejecutado' })], 'on'), null);
  });

  it('NO reconcilia un comando pendiente', () => {
    // Un pendiente aún no se ha escrito: darlo por ejecutado sería
    // adelantarse al propio envío.
    assert.equal(seleccionarReconciliable([comando({ estado: 'pendiente' })], 'on'), null);
  });

  it('salta al siguiente si el más reciente no coincide', () => {
    const r = seleccionarReconciliable(
      [comando({ id: 'off', comando: 'OFF' }), comando({ id: 'on', comando: 'ON' })],
      'on'
    );
    assert.equal(r?.id, 'on');
  });

  it('NO reconcilia si no hay ninguno que coincida', () => {
    assert.equal(seleccionarReconciliable([comando({ comando: 'ON' })], 'off'), null);
  });
});

describe('ventana de reconciliación', () => {
  it('es de 2 minutos, no de 10', () => {
    /*
     * Con 10 minutos, un ON fallido de hace 9 se daría por bueno porque
     * alguien encendió el equipo a mano: eso no es confirmar, es coincidir.
     */
    assert.equal(VENTANA_RECONCILIACION_MIN, 2);
  });
});

describe('respuestaReconciliada', () => {
  it('conserva el error original como advertencia', () => {
    const original = {
      motivo: 'timeout',
      valor_esperado: 1,
      advertencia: 'escritura reportó error: ECONNRESET',
    };

    const r = respuestaReconciliada(
      comando({ respuesta: original }),
      'on',
      new Date('2026-11-08T12:00:00Z')
    );

    // El error NO se oculta.
    assert.equal(r.advertencia, 'escritura reportó error: ECONNRESET');
    assert.equal(r.valor_esperado, 1);
    assert.equal(r.motivo_original, 'timeout');
  });

  it('marca la confirmación como indirecta', () => {
    const r = respuestaReconciliada(comando(), 'on', new Date());
    assert.equal(r.confirmado_por, 'estado_reportado');
  });

  it('guarda el estado que reportó el equipo', () => {
    const r = respuestaReconciliada(comando(), 'encendido', new Date());
    assert.equal(r.estado_reportado, 'encendido');
  });

  it('funciona con un comando sin respuesta previa', () => {
    const r = respuestaReconciliada(comando({ respuesta: null }), 'on', new Date());
    assert.equal(r.confirmado_por, 'estado_reportado');
    assert.equal(r.motivo_original, null);
  });
});
