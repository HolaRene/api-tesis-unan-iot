import { z } from 'zod';

import { PROTOCOLOS_ACTUADOR } from './direccionamiento.js';

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

/**
 * Protocolo de accionamiento.
 *
 * Se valida contra la lista real: un valor desconocido caería en el caso por
 * defecto al construir el direccionamiento y el comando saldría sin destino,
 * fallando en silencio.
 */
const protocolo = z.enum(PROTOCOLOS_ACTUADOR, {
  message: 'El protocolo debe ser modbus, gpio, mqtt o http',
});

/**
 * Direccionamiento del actuador.
 *
 * El detalle (dirección Modbus, pin GPIO…) depende del protocolo y se valida
 * en el servicio. Aquí solo se comprueba que sea un objeto.
 */
const configuracion = z.record(z.string(), z.unknown()).optional().nullable();

export const crearActuadorSchema = z.object({
  dispositivo_id: uuidObligatorio,
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  /*
   * El `codigo` NO se exige: lo genera el servidor a partir del tipo y el
   * nombre. Se acepta si llega, para no romper clientes antiguos, pero el
   * servicio lo descarta y usa el suyo.
   */
  codigo: z
    .string()
    .trim()
    .max(100, 'El código no puede superar 100 caracteres')
    .optional(),
  tipo: z
    .string()
    .min(1, 'El tipo es obligatorio')
    .max(50, 'El tipo no puede superar 50 caracteres'),
  estado_actual: textoOpcional(50),
  activo: z.boolean().optional(),
  protocolo: protocolo.optional(),
  configuracion,
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
    protocolo: protocolo.optional(),
    configuracion,
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe proporcionar al menos un campo',
  });

export type CrearActuadorBody = z.infer<typeof crearActuadorSchema>;
export type ActualizarActuadorBody = z.infer<typeof actualizarActuadorSchema>;
