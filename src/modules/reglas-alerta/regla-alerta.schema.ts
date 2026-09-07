import { z } from 'zod';

/**
 * Esquemas Zod del módulo Reglas de Alerta.
 * El operador debe coincidir con el tipo de dato del canal (validación de
 * negocio en el service por si el canal cambia).
 */
export const OPERADORES_NUMERIC = ['>', '>=', '<', '<=', '=', 'entre', 'fuera_de_rango'] as const;
export const OPERADORES_BOOLEAN = ['es_true', 'es_false'] as const;
export const OPERADORES_TEXT = ['igual_a', 'diferente_de', 'contiene'] as const;

const num = z.coerce.number().optional().nullable();
const opcTexto = (max = 2000) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v?.trim() ? v.trim() : null));

export const crearReglaSchema = z.object({
  canal_id: z.string().uuid('El id del canal no es válido'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  descripcion: opcTexto(2000),
  operador: z.string().trim().min(1, 'El operador es obligatorio'),
  valor_referencia_numerico: num,
  valor_referencia_texto: z.string().optional().nullable(),
  valor_referencia_booleano: z.boolean().optional().nullable(),
  valor_min: num,
  valor_max: num,
  severidad: z.enum(['info', 'warning', 'critical']),
  mensaje: opcTexto(2000),
  activa: z.boolean().optional(),
  retardo_segundos: z.coerce.number().int().positive().optional().nullable(),
});

export const actualizarReglaSchema = z
  .object({
    canal_id: z.string().uuid('El id del canal no es válido').optional(),
    nombre: z.string().trim().min(1).max(120).optional(),
    descripcion: opcTexto(2000),
    operador: z.string().trim().min(1).optional(),
    valor_referencia_numerico: num,
    valor_referencia_texto: z.string().optional().nullable(),
    valor_referencia_booleano: z.boolean().optional().nullable(),
    valor_min: num,
    valor_max: num,
    severidad: z.enum(['info', 'warning', 'critical']).optional(),
    mensaje: opcTexto(2000),
    activa: z.boolean().optional(),
    retardo_segundos: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe enviar al menos un campo' });

export const idReglaSchema = z.object({ id: z.string().uuid('El id de la regla no es válido') });

export type CrearReglaBody = z.infer<typeof crearReglaSchema>;
export type ActualizarReglaBody = z.infer<typeof actualizarReglaSchema>;
