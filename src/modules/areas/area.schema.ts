import { z } from 'zod';

/**
 * Esquemas Zod del módulo de áreas.
 */

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 255) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** Esquema para crear un área. */
export const crearAreaSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  tipo: textoOpcional(50),
  descripcion: textoOpcional(1000),
  ubicacion: textoOpcional(255),
  activo: z.boolean().optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idAreaSchema = z.object({
  id: z.string().uuid('El id del área no es válido'),
});

/**
 * Esquema para actualizar un área. Todos los campos son opcionales,
 * pero al menos uno debe estar presente.
 */
export const actualizarAreaSchema = z
  .object({
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),
    tipo: textoOpcional(50),
    descripcion: textoOpcional(1000),
    ubicacion: textoOpcional(255),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearAreaBody = z.infer<typeof crearAreaSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarAreaBody = z.infer<typeof actualizarAreaSchema>;
