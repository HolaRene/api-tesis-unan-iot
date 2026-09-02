import { z } from 'zod';

/**
 * Esquemas Zod del módulo de alertas.
 */

/** Estados válidos para una alerta. */
const estadosValidos = ['active', 'acknowledged', 'resolved'] as const;

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 50) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** Fecha opcional. */
const fechaOpcional = z.coerce.date().optional().nullable();

/** UUID opcional. */
const uuidOpcional = z.string().uuid('No es un id válido').optional().nullable();

/** Esquema para crear una alerta. */
export const crearAlertSchema = z.object({
  sensor_id: uuidOpcional,
  medicion_id: z.coerce.number().int().positive().optional().nullable(),
  tipo: textoOpcional(50),
  severidad: textoOpcional(20),
  mensaje: textoOpcional(2000),
  estado: z.enum(estadosValidos).optional(),
  reconocida_en: fechaOpcional,
  finalizada_en: fechaOpcional,
  metadatos: z.record(z.string(), z.unknown()).optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idAlertSchema = z.object({
  id: z.string().uuid('El id de la alerta no es válido'),
});

/** Esquema para actualizar una alerta. Todos los campos son opcionales. */
export const actualizarAlertSchema = z
  .object({
    sensor_id: uuidOpcional,
    medicion_id: z.coerce.number().int().positive().optional().nullable(),
    tipo: textoOpcional(50),
    severidad: textoOpcional(20),
    mensaje: textoOpcional(2000),
    estado: z.enum(estadosValidos).optional(),
    reconocida_en: fechaOpcional,
    finalizada_en: fechaOpcional,
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearAlertBody = z.infer<typeof crearAlertSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarAlertBody = z.infer<typeof actualizarAlertSchema>;
