/**
 * Validación de las normas (plantillas de alerta) para el CRUD.
 *
 * Reutiliza el esquema de regla de los JSON (`reglaPlantillaSchema`) para
 * que una norma creada desde la web tenga exactamente la misma forma que
 * una sembrada desde el repositorio. Si divergieran, aplicar una u otra
 * daría resultados distintos.
 */
import { z } from 'zod';

import { reglaPlantillaSchema } from './plantilla-alerta.service.js';

/** Identificador legible: minúsculas, números y guiones. */
const idSchema = z
  .string()
  .trim()
  .min(2, 'El identificador es demasiado corto')
  .max(80, 'El identificador no puede superar 80 caracteres')
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Solo minúsculas, números y guiones (p. ej. «camara-fria-almacen»)'
  );

const reglasSchema = z
  .array(reglaPlantillaSchema)
  .min(1, 'Una norma debe tener al menos una regla');

export const esquemaCrearPlantilla = z
  .object({
    id: idSchema,
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
    descripcion: z.string().trim().max(1000).optional().nullable(),
    norma: z.string().trim().min(1, 'La norma de referencia es obligatoria').max(200),
    notas: z.array(z.string().max(500)).max(30).optional(),
    reglas: reglasSchema,
  })
  .strict();

export const esquemaActualizarPlantilla = z
  .object({
    nombre: z.string().trim().min(1).max(150).optional(),
    descripcion: z.string().trim().max(1000).optional().nullable(),
    norma: z.string().trim().min(1).max(200).optional(),
    notas: z.array(z.string().max(500)).max(30).optional(),
    reglas: reglasSchema.optional(),
  })
  .strict();

/**
 * Evaluación puntual: el valor y las reglas llegan en el cuerpo.
 *
 * `calidad` permite que `bad` devuelva `falla` sin mirar las reglas, igual
 * que hace la clasificación real con una medición de sensor averiado.
 */
export const esquemaEvaluar = z
  .object({
    valor: z.number().nullable().optional(),
    reglas: z.array(reglaPlantillaSchema),
    calidad: z.string().max(20).optional(),
  })
  .strict();
