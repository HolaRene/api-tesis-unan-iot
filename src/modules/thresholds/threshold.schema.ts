import { z } from 'zod';

/**
 * Esquemas Zod del módulo de umbrales.
 */

/** Número opcional que se normaliza: null si no aplica. */
const numOpcional = z
  .number()
  .optional()
  .nullable()
  .transform((valor) => (valor === undefined ? null : valor));

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 30) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** UUID opcional. */
const uuidOpcional = z.string().uuid('El id del sensor no es válido').optional().nullable();

/** Esquema para crear un umbral. */
export const crearThresholdSchema = z.object({
  sensor_id: uuidOpcional,
  valor_min: numOpcional,
  valor_max: numOpcional,
  severidad: textoOpcional(30),
  activo: z.boolean().optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idThresholdSchema = z.object({
  id: z.string().uuid('El id del umbral no es válido'),
});

/** Esquema para actualizar un umbral. Todos los campos son opcionales. */
export const actualizarThresholdSchema = z
  .object({
    sensor_id: uuidOpcional,
    valor_min: numOpcional,
    valor_max: numOpcional,
    severidad: textoOpcional(30),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearThresholdBody = z.infer<typeof crearThresholdSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarThresholdBody = z.infer<typeof actualizarThresholdSchema>;
