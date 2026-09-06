import { z } from 'zod';

/**
 * Esquemas Zod del módulo de actuadores.
 */

const textoOpcional = (max: number) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null));

const uuidObligatorio = z
  .string()
  .uuid('El id del dispositivo no es válido');

export const crearActuadorSchema = z.object({
  dispositivo_id: uuidObligatorio,
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  codigo: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(100, 'El código no puede superar 100 caracteres'),
  tipo: z
    .string()
    .min(1, 'El tipo es obligatorio')
    .max(50, 'El tipo no puede superar 50 caracteres'),
  estado_actual: textoOpcional(50),
  activo: z.boolean().optional(),
  configuracion: z.record(z.string(), z.unknown()).optional(),
});

export const idActuadorSchema = z.object({
  id: z.string().uuid('El id del actuador no es válido'),
});

export const actualizarActuadorSchema = z
  .object({
    dispositivo_id: uuidObligatorio.optional(),
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),
    codigo: z
      .string()
      .min(1, 'El código es obligatorio')
      .max(100, 'El código no puede superar 100 caracteres')
      .optional(),
    tipo: z
      .string()
      .min(1, 'El tipo es obligatorio')
      .max(50, 'El tipo no puede superar 50 caracteres')
      .optional(),
    estado_actual: textoOpcional(50),
    activo: z.boolean().optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe proporcionar al menos un campo',
  });

export type CrearActuadorBody = z.infer<typeof crearActuadorSchema>;
export type ActualizarActuadorBody = z.infer<typeof actualizarActuadorSchema>;
