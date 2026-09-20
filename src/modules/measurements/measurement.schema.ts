import { z } from 'zod';
import { INTERVALOS_AGREGACION } from './measurement.types.js';

/**
 * Esquemas Zod del módulo de mediciones.
 */

/**
 * Esquema para registrar (ingerir) una medición.
 * Se acepta cualquiera de los tipos de valor, siempre que al menos uno
 * esté presente. Node-RED u otros emisores pueden enviar el valor
 * según el tipo del sensor.
 */
export const crearMeasurementSchema = z
  .object({
    sensor_id: z.string().uuid('El id del sensor no es válido'),
    valor_numerico: z.number().optional(),
    valor_texto: z.string().optional(),
    valor_booleano: z.boolean().optional(),
    valor_json: z.record(z.string(), z.unknown()).optional(),
    calidad: z
      .string()
      .max(20, 'La calidad no puede superar 20 caracteres')
      .optional(),
    registrado_en: z.coerce.date().optional(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (datos) =>
      datos.valor_numerico !== undefined ||
      datos.valor_texto !== undefined ||
      datos.valor_booleano !== undefined ||
      datos.valor_json !== undefined,
    {
      message:
        'Debe proporcionar al menos un valor (valor_numerico, valor_texto, valor_booleano o valor_json)',
    }
  );

/** Esquema para el parámetro de ruta `:id`. */
export const idMedicionSchema = z.object({
  id: z.coerce.number().int().positive('El id no es válido'),
});

/** Esquema para el query de listado (filtro por sensor y límite). */
export const listarMedicionesSchema = z.object({
  sensor_id: z.string().uuid('El id del sensor no es válido').optional(),
  canal_id: z.string().uuid('El id del canal no es válido').optional(),
  dispositivo_id: z.string().uuid('El id del dispositivo no es válido').optional(),
  area_id: z.string().uuid('El id del área no es válido').optional(),
  tipo_variable_id: z.string().uuid('El id del tipo no es válido').optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  orden: z.enum(['asc', 'desc']).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100).optional(),
});

/** Tipo inferido del esquema de creación (ingesta). */
export type CrearMeasurementBody = z.infer<typeof crearMeasurementSchema>;

/** Tipo inferido del esquema de listado. */
export type ListarMedicionesQuery = z.infer<typeof listarMedicionesSchema>;

/**
 * Esquema del query para las SERIES AGREGADAS.
 *
 * `intervalo` se valida contra la lista blanca de intervalos permitidos: ese
 * valor acaba dentro del SQL (`date_trunc`), por lo que NUNCA debe llegar
 * libre desde el cliente.
 */
export const seriesMedicionesSchema = z.object({
  sensor_id: z.string().uuid('El id del sensor no es válido').optional(),
  canal_id: z.string().uuid('El id del canal no es válido').optional(),
  dispositivo_id: z
    .string()
    .uuid('El id del dispositivo no es válido')
    .optional(),
  area_id: z.string().uuid('El id del área no es válido').optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  intervalo: z.enum(INTERVALOS_AGREGACION).default('hora'),
  /** Nº máximo de cubos devueltos (protege la respuesta). */
  limite: z.coerce.number().int().min(1).max(2000).default(1000),
});

export type SeriesMedicionesQuery = z.infer<typeof seriesMedicionesSchema>;
