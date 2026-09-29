import { z } from 'zod';

/**
 * Esquemas Zod del módulo de comandos de actuadores.
 */

/** Esquema para registrar un comando desde la WEB (JWT).
 * El actuador va en la URL (`/actuadores/:id/comandos`); el body solo
 * lleva `comando`, `valor` (opcional) y `metadatos`.
 */
export const crearComandoWebSchema = z.object({
  comando: z.string().min(1, 'El comando es obligatorio').max(100, 'El comando no puede superar 100 caracteres'),
  valor: z.any().optional(),
  metadatos: z.record(z.string(), z.unknown()).optional(),
});

/** Esquema para consultar comandos de un actuador (query). */
export const listarComandosSchema = z.object({
  limite: z.coerce.number().int().positive().max(200).optional(),
});

/** Esquema del parámetro de ruta de actuador id. */
export const idActuadorParamSchema = z.object({
  id: z.string().uuid('El id del actuador no es válido'),
});

/**
 * Esquema para CONFIRMAR un comando (lo usa Node-RED, autenticado con API Key).
 *
 * `estado` describe lo que realmente ocurrió:
 *   - 'enviado'   → publicado en MQTT, el equipo aún no ha confirmado.
 *   - 'ejecutado' → el equipo confirmó que aplicó la orden.
 *   - 'fallido'   → no se pudo entregar.
 *
 * No se permite volver a 'pendiente' desde aquí: eso lo controla la web.
 */
export const confirmarComandoSchema = z
  .object({
    estado: z.enum(['enviado', 'ejecutado', 'fallido'], {
      message: 'Estado no válido (use enviado, ejecutado o fallido)',
    }),
    /** Respuesta del equipo; se guarda tal cual para trazabilidad. */
    respuesta: z.record(z.string(), z.unknown()).optional(),
    /**
     * Nuevo estado del actuador si la orden se ejecutó ('on', 'off'…).
     * Refleja el estado REAL del equipo, no lo que se pidió.
     */
    estado_actuador: z
      .string()
      .max(50, 'El estado no puede superar 50 caracteres')
      .optional(),
  })
  .strict();

/** Esquema del parámetro de ruta de comando id. */
export const idComandoParamSchema = z.object({
  id: z.string().uuid('El id del comando no es válido'),
});

/**
 * Esquema para consultar comandos pendientes (query).
 *
 * Los filtros son opcionales y sirven para que un equipo concreto pregunte
 * SOLO por lo suyo:
 *
 *   - Sin filtros     → todo (lo usa Node-RED).
 *   - `identificador` → comandos de los actuadores de ese dispositivo.
 *   - `actuador`      → comandos de un actuador concreto.
 *
 * Ejemplo desde un ESP32 con un buzzer:
 *   GET /iot/comandos/pendientes?identificador=ESP32-BUZZER
 */
export const listarPendientesSchema = z.object({
  limite: z.coerce.number().int().positive().max(200).optional(),
  /** Identificador del dispositivo que pregunta (p. ej. ESP32-BUZZER). */
  identificador: z.string().min(1).max(100).optional(),
  /** Código del actuador concreto (p. ej. BUZZER-1). */
  actuador: z.string().min(1).max(100).optional(),
});

export type CrearComandoWebBody = z.infer<typeof crearComandoWebSchema>;
export type ConfirmarComandoBody = z.infer<typeof confirmarComandoSchema>;
