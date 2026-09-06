import { z } from 'zod';

/**
 * Esquemas Zod del módulo IoT (rutas de integración autenticadas por API Key).
 */

/** Objeto que representa una medición por código de sensor. */
const medicionEntradaSchema = z
  .object({
    sensor: z.string().min(1, 'El código del sensor es obligatorio'),
    valor: z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.record(z.string(), z.unknown()),
      z.null(),
    ]),
  })
  .strict();

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

export type IngestaMedicionesBody = z.infer<typeof ingestaMedicionesSchema>;
export type ComandoIntegracionBody = z.infer<typeof comandoIntegracionSchema>;
