import { z } from 'zod';

/**
 * Esquemas Zod del módulo IoT (rutas de integración autenticadas por API Key).
 */

/** Objeto que representa una medición por canal (o sensor, por compatibilidad). */
const medicionEntradaSchema = z
  .object({
    canal: z.string().min(1, 'El código del canal es obligatorio').optional(),
    sensor: z.string().min(1, 'El código del sensor es obligatorio').optional(),
    valor: z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.record(z.string(), z.unknown()),
      z.null(),
    ]),
  })
  .refine((m) => m.canal !== undefined || m.sensor !== undefined, {
    message: 'Cada medición debe indicar "canal" o "sensor"',
  });

/** Payload para POST /api/v1/iot/mediciones. */
export const ingestaMedicionesSchema = z
  .object({
    dispositivo: z
      .string()
      .min(1, 'El identificador del dispositivo es obligatorio'),
    mediciones: z.array(medicionEntradaSchema).min(1, 'Debe enviar al menos una medición'),
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** Payload para POST /api/v1/iot/comandos. */
export const comandoIntegracionSchema = z
  .object({
    actuador: z.string().min(1, 'El código del actuador es obligatorio'),
    comando: z.string().min(1, 'El comando es obligatorio').max(100),
    valor: z
      .union([
        z.boolean(),
        z.number(),
        z.string(),
        z.record(z.string(), z.unknown()),
      ])
      .optional(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/**
 * Payload para POST /api/v1/iot/dispositivos/:identificador/estado.
 * Heartbeat de estado que puede enviar el propio equipo (PLC, ESP32, RPi…).
 */
export const estadoDispositivoSchema = z
  .object({
    estado: z
      .enum(['online', 'offline', 'mantenimiento', 'error'])
      .optional(),
    direccion_ip: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'La dirección IP no es válida')
      .optional()
      .nullable(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type IngestaMedicionesBody = z.infer<typeof ingestaMedicionesSchema>;
export type ComandoIntegracionBody = z.infer<typeof comandoIntegracionSchema>;
export type EstadoDispositivoBody = z.infer<typeof estadoDispositivoSchema>;
