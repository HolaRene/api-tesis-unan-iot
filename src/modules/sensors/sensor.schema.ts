import { z } from 'zod';

/**
 * Esquemas Zod del módulo de sensores.
 */

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 100) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** Número opcional que se normaliza: null si no aplica. */
const numOpcional = z
  .number()
  .optional()
  .nullable()
  .transform((valor) => (valor === undefined ? null : valor));

/** UUID opcional. */
const uuidOpcional = z.string().uuid('No es un id válido').optional().nullable();

/**
 * Magnitud (canal) declarada al crear/actualizar un sensor.
 *
 * Permite que un mismo sensor físico exponga varias magnitudes, p. ej. un
 * DHT22 con temperatura y humedad relativa. Si no se indica `codigo`/`nombre`
 * se derivan del sensor y del tipo de variable.
 */
export const magnitudSensorSchema = z.object({
  tipo_variable_id: z.string().uuid('El tipo de variable no es válido'),
  codigo: z.string().trim().min(1).max(100).optional().nullable(),
  nombre: z.string().trim().min(1).max(120).optional().nullable(),
  unidad: textoOpcional(30),
  rango_min: numOpcional,
  rango_max: numOpcional,
  precision_valor: numOpcional,
  activo: z.boolean().optional(),
});

export type MagnitudSensorBody = z.infer<typeof magnitudSensorSchema>;

/** Esquema para crear un sensor. */
export const crearSensorSchema = z.object({
  dispositivo_id: uuidOpcional,
  tipo_variable_id: uuidOpcional,
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  codigo: z
    .string()
    .min(1, 'El código es obligatorio')
    .max(100, 'El código no puede superar 100 caracteres'),
  fabricante: textoOpcional(100),
  modelo: textoOpcional(100),
  unidad: textoOpcional(30),
  rango_min: numOpcional,
  rango_max: numOpcional,
  precision: numOpcional,
  activo: z.boolean().optional(),
  configuracion: z.record(z.string(), z.unknown()).optional(),
  /**
   * Magnitudes del sensor (una o varias). Si se omite, se crea un canal con
   * la magnitud principal (`tipo_variable_id`). Ej. DHT22:
   * `[{ tipo_variable_id: <temperatura> }, { tipo_variable_id: <humedad> }]`.
   */
  canales: z.array(magnitudSensorSchema).optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idSensorSchema = z.object({
  id: z.string().uuid('El id del sensor no es válido'),
});

/** Esquema para actualizar un sensor. Todos los campos son opcionales. */
export const actualizarSensorSchema = z
  .object({
    dispositivo_id: uuidOpcional,
    tipo_variable_id: uuidOpcional,
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
    fabricante: textoOpcional(100),
    modelo: textoOpcional(100),
    unidad: textoOpcional(30),
    rango_min: numOpcional,
    rango_max: numOpcional,
    precision: numOpcional,
    activo: z.boolean().optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
    /** Si se envía, reemplaza/crea las magnitudes (canales) del sensor. */
    canales: z.array(magnitudSensorSchema).optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearSensorBody = z.infer<typeof crearSensorSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarSensorBody = z.infer<typeof actualizarSensorSchema>;
