import { z } from 'zod';

/**
 * Esquemas Zod del módulo de tipos de variable.
 */

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 100) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** Esquema para crear un tipo de variable. */
export const crearVariableTypeSchema = z.object({
  codigo: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(50, 'El código no puede superar 50 caracteres'),
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  descripcion: textoOpcional(1000),
  tipo_dato: z.enum(['numeric', 'boolean', 'text', 'json']),
  unidad_default: textoOpcional(30),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idVariableTypeSchema = z.object({
  id: z.string().uuid('El id del tipo de variable no es válido'),
});

/** Esquema para actualizar un tipo de variable. Todos los campos son opcionales. */
export const actualizarVariableTypeSchema = z
  .object({
    codigo: z
      .string()
      .min(1, 'El código es obligatorio')
      .max(50, 'El código no puede superar 50 caracteres')
      .optional(),
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),
    descripcion: textoOpcional(1000),
    tipo_dato: z.enum(['numeric', 'boolean', 'text', 'json']).optional(),
    unidad_default: textoOpcional(30),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearVariableTypeBody = z.infer<typeof crearVariableTypeSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarVariableTypeBody = z.infer<typeof actualizarVariableTypeSchema>;
