/**
 * Tests del schema Zod del módulo de cámaras IP.
 *
 * Cubren las validaciones y DOS regresiones reales detectadas en pruebas:
 *   1. Un PATCH parcial NO debe borrar campos ausentes (el `transform`
 *      encadenado tras `.optional().nullable()` devolvía `null`).
 *   2. Se deben RECHAZAR credenciales embebidas en las rutas.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  actualizarCamaraSchema,
  actualizarEstadoCamaraSchema,
  crearCamaraSchema,
  listarCamarasSchema,
} from './camera.schema.js';

describe('schema de cámaras IP', () => {
  describe('crearCamaraSchema', () => {
    test('acepta el payload de ejemplo del enunciado', () => {
      const r = crearCamaraSchema.safeParse({
        nombre: 'Cámara Quirófano 1',
        descripcion: 'Cámara de supervisión visual',
        direccion_ip: '192.168.1.50',
        puerto_rtsp: 554,
        ruta_stream: '/stream1',
        ruta_webrtc: '/camara-qui-1',
        activa: true,
      });
      assert.equal(r.success, true);
    });

    test('añade la barra inicial si falta', () => {
      const r = crearCamaraSchema.parse({
        nombre: 'C',
        ruta_stream: 'stream1',
        ruta_webrtc: 'camara-1',
      });
      assert.equal(r.ruta_stream, '/stream1');
      assert.equal(r.ruta_webrtc, '/camara-1');
    });

    test('exige nombre y ruta_stream', () => {
      assert.equal(crearCamaraSchema.safeParse({ ruta_stream: '/s' }).success, false);
      assert.equal(crearCamaraSchema.safeParse({ nombre: 'C' }).success, false);
    });

    test('RECHAZA una URL RTSP completa con credenciales', () => {
      const r = crearCamaraSchema.safeParse({
        nombre: 'C',
        ruta_stream: 'rtsp://admin:secreto@192.168.1.9/stream1',
      });
      assert.equal(r.success, false, 'no debe permitir credenciales');
    });

    test('RECHAZA una ruta con "@"', () => {
      const r = crearCamaraSchema.safeParse({
        nombre: 'C',
        ruta_stream: '/user:pass@stream',
      });
      assert.equal(r.success, false);
    });

    test('RECHAZA campos desconocidos (strict)', () => {
      const r = crearCamaraSchema.safeParse({
        nombre: 'C',
        ruta_stream: '/s',
        usuario_rtsp: 'admin',
      });
      assert.equal(r.success, false, 'no debe aceptar campos de credenciales');
    });

    test('valida el puerto RTSP', () => {
      assert.equal(
        crearCamaraSchema.safeParse({ nombre: 'C', ruta_stream: '/s', puerto_rtsp: 0 }).success,
        false
      );
      assert.equal(
        crearCamaraSchema.safeParse({ nombre: 'C', ruta_stream: '/s', puerto_rtsp: 70000 }).success,
        false
      );
    });

    test('valida el formato de la IP', () => {
      assert.equal(
        crearCamaraSchema.safeParse({ nombre: 'C', ruta_stream: '/s', direccion_ip: 'no-es-ip' })
          .success,
        false
      );
    });
  });

  describe('actualizarCamaraSchema (REGRESIÓN: no borrar campos ausentes)', () => {
    test('un PATCH que solo cambia el nombre NO toca otros campos', () => {
      const r = actualizarCamaraSchema.parse({ nombre: 'Solo nombre' });
      assert.deepEqual(Object.keys(r), ['nombre']);
      assert.equal('ruta_webrtc' in r, false, 'no debe inventar ruta_webrtc');
      assert.equal('ruta_stream' in r, false);
      assert.equal('direccion_ip' in r, false);
      assert.equal('descripcion' in r, false);
    });

    test('un PATCH de estado NO borra la ruta WebRTC', () => {
      const r = actualizarCamaraSchema.parse({ estado: 'conectada' });
      assert.deepEqual(Object.keys(r), ['estado']);
    });

    test('permite borrar explícitamente con null', () => {
      const r = actualizarCamaraSchema.parse({ ruta_webrtc: null });
      assert.equal(r.ruta_webrtc, null);
    });

    test('normaliza la ruta cuando SÍ se envía', () => {
      const r = actualizarCamaraSchema.parse({ ruta_webrtc: 'nueva' });
      assert.equal(r.ruta_webrtc, '/nueva');
    });

    test('exige al menos un campo', () => {
      assert.equal(actualizarCamaraSchema.safeParse({}).success, false);
    });
  });

  describe('actualizarEstadoCamaraSchema', () => {
    test('acepta los 5 estados válidos', () => {
      for (const estado of ['activa', 'inactiva', 'conectada', 'desconectada', 'error']) {
        assert.equal(
          actualizarEstadoCamaraSchema.safeParse({ estado }).success,
          true,
          `debería aceptar ${estado}`
        );
      }
    });

    test('rechaza un estado inventado', () => {
      assert.equal(
        actualizarEstadoCamaraSchema.safeParse({ estado: 'encendida' }).success,
        false
      );
    });
  });

  describe('listarCamarasSchema', () => {
    test('convierte activa="true" a booleano', () => {
      assert.equal(listarCamarasSchema.parse({ activa: 'true' }).activa, true);
      assert.equal(listarCamarasSchema.parse({ activa: 'false' }).activa, false);
    });

    test('rechaza un estado inválido en el filtro', () => {
      assert.equal(listarCamarasSchema.safeParse({ estado: 'raro' }).success, false);
    });
  });
});
