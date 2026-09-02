import { z } from 'zod';

/**
 * Esquemas Zod del módulo de dispositivos.
 */

/** Texto opcional que se normaliza: vacío -> null. */
const textoOpcional = (max = 255) =>
  z
    .string()
    .max(max, `No puede superar ${max} caracteres`)
    .optional()
    .nullable()
    .transform((valor) => (valor?.trim() ? valor.trim() : null));

/** Dirección IP opcional en formato INET. */
const direccionIpOpcional = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'La dirección IP no es válida')
  .optional()
  .nullable();

/** Esquema de UUID opcional para area_id. */
const uuidOpcional = z
  .string()
  .uuid('El id del área no es válido')
  .optional()
  .nullable();

/** Esquema para crear un dispositivo. */
export const crearDeviceSchema = z.object({
  area_id: uuidOpcional,
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  tipo: z
    .string()
    .min(1, 'El tipo es obligatorio')
    .max(50, 'El tipo no puede superar 50 caracteres'),
  fabricante: textoOpcional(100),
  modelo: textoOpcional(100),
  identificador: textoOpcional(100),
  protocolo: textoOpcional(50),
  direccion_ip: direccionIpOpcional,
  estado: z.string().max(30, 'El estado no puede superar 30 caracteres').optional(),
  metadatos: z.record(z.string(), z.unknown()).optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idDeviceSchema = z.object({
  id: z.string().uuid('El id del dispositivo no es válido'),
});

/**
 * Esquema para actualizar un dispositivo. Todos los campos son opcionales.
 */
export const actualizarDeviceSchema = z
  .object({
    area_id: uuidOpcional,
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),
    tipo: z
      .string()
      .min(1, 'El tipo es obligatorio')
      .max(50, 'El tipo no puede superar 50 caracteres')
      .optional(),
    fabricante: textoOpcional(100),
    modelo: textoOpcional(100),
    identificador: textoOpcional(100),
    protocolo: textoOpcional(50),
    direccion_ip: direccionIpOpcional,
    estado: z.string().max(30, 'El estado no puede superar 30 caracteres').optional(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación. */
export type CrearDeviceBody = z.infer<typeof crearDeviceSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarDeviceBody = z.infer<typeof actualizarDeviceSchema>;
