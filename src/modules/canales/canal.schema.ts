import { z } from 'zod';

/**
 * Esquemas Zod del módulo Canales.
 */
const idOpcional = z.string().uuid('No es un id válido').optional().nullable();
const textoOpcional = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v?.trim() ? v.trim() : null));
const numOpcional = z.coerce.number().optional().nullable();

/** Crear canal. */
export const crearCanalSchema = z.object({
  sensor_id: idOpcional,
  tipo_variable_id: idOpcional,
  codigo: z.string().trim().min(1, 'El código es obligatorio').max(100),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  descripcion: textoOpcional(1000),
  unidad: textoOpcional(30),
  rango_min: numOpcional,
  rango_max: numOpcional,
  precision_valor: numOpcional,
  activo: z.boolean().optional(),
  configuracion: z.record(z.string(), z.unknown()).optional(),
});

/** Actualizar canal. Todos opcionales. */
export const actualizarCanalSchema = z
  .object({
    sensor_id: idOpcional,
    tipo_variable_id: idOpcional,
    codigo: z.string().trim().min(1).max(100).optional(),
    nombre: z.string().trim().min(1).max(120).optional(),
    descripcion: textoOpcional(1000),
    unidad: textoOpcional(30),
    rango_min: numOpcional,
    rango_max: numOpcional,
    precision_valor: numOpcional,
    activo: z.boolean().optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe proporcionar al menos un campo',
  });

/** Ruta id UUID. */
export const idCanalSchema = z.object({ id: z.string().uuid('El id del canal no es válido') });

export type CrearCanalBody = z.infer<typeof crearCanalSchema>;
export type ActualizarCanalBody = z.infer<typeof actualizarCanalSchema>;
