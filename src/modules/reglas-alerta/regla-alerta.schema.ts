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

/**
 * Comprueba que un rango tenga sentido.
 *
 * Una regla `entre 60 y 40` es imposible de cumplir: ningún valor puede ser
 * a la vez mayor o igual que 60 y menor o igual que 40. Antes se guardaba
 * sin error y aparecía configurada en la interfaz, pero **no disparaba
 * nunca**.
 *
 * Ese fallo es de los peores: no hay error, no hay aviso, simplemente un
 * umbral que no protege de nada.
 */
function validarRango(
  datos: {
    operador?: string;
    valor_min?: number | null;
    valor_max?: number | null;
  },
  ctx: z.RefinementCtx,
  /**
   * En una ACTUALIZACIÓN puede no venir el operador.
   *
   * Si llegan los dos extremos, el rango ya puede comprobarse: un cuerpo
   * `{ valor_min: 60, valor_max: 40 }` es inválido se llame como se llame el
   * operador que ya tuviera la regla. Sin esta opción, ese caso se colaba.
   */
  validarSinOperador = false
): void {
  const esRango =
    datos.operador === 'entre' ||
    datos.operador === 'fuera_de_rango' ||
    (validarSinOperador &&
      datos.valor_min !== undefined &&
      datos.valor_max !== undefined);
  if (!esRango) return;

  const min = datos.valor_min;
  const max = datos.valor_max;

  if (min === null || min === undefined || max === null || max === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valor_min'],
      message:
        'Los operadores de rango necesitan un valor mínimo y un valor máximo',
    });
    return;
  }

  if (min > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valor_min'],
      message:
        'El valor mínimo no puede ser mayor que el máximo: la regla nunca se cumpliría',
    });
  }
}

export const crearReglaSchema = z
  .object({
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
    // Margen para cerrar la alerta. 0 o null = sin margen.
    histeresis: z.coerce.number().nonnegative().optional().nullable(),
  })
  .superRefine(validarRango);

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
    // Margen para cerrar la alerta. 0 o null = sin margen.
    histeresis: z.coerce.number().nonnegative().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo',
  })
  /*
   * En una ACTUALIZACIÓN puede venir solo `valor_min`.
   *
   * Se valida únicamente si el cuerpo trae el operador o los dos extremos;
   * si no, no hay información suficiente y la comprobación completa se hace
   * en el servicio con los datos ya fusionados. Así no se rechaza una
   * edición parcial legítima.
   */
  .superRefine((datos, ctx) => {
    const traeOperador = datos.operador !== undefined;
    const traeAmbos =
      datos.valor_min !== undefined && datos.valor_max !== undefined;
    if (traeOperador || traeAmbos) validarRango(datos, ctx, traeAmbos);
  });

export const idReglaSchema = z.object({ id: z.string().uuid('El id de la regla no es válido') });

export type CrearReglaBody = z.infer<typeof crearReglaSchema>;
export type ActualizarReglaBody = z.infer<typeof actualizarReglaSchema>;
