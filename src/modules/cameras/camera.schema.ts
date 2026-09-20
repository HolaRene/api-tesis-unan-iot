import { z } from 'zod';
import { ESTADOS_CAMARA } from './camera.types.js';

/**
 * Esquemas Zod del módulo de cámaras IP.
 *
 * SEGURIDAD: se RECHAZAN valores que parezcan contener credenciales
 * (URLs con `://`, `@`, usuario:contraseña). La API solo guarda el PATH
 * del stream; las credenciales viven en MediaMTX.
 */

/**
 * Texto opcional que se normaliza: vacío -> null.
 *
 * IMPORTANTE: el `transform` NO debe ejecutarse cuando el campo está
 * ausente. Si se encadena `.optional().nullable().transform(...)`, zod
 * aplica el transform igualmente y devuelve `null`, lo que en un PATCH
 * PARCIAL borraría el valor existente sin que el cliente lo pida.
 *
 * Solución: se valida `undefined` explícitamente y se deja pasar tal cual.
 */
const textoOpcional = (max = 255) =>
  z
    .union([
      z
        .string()
        .max(max, `No puede superar ${max} caracteres`)
        .transform((valor) => (valor.trim() ? valor.trim() : null)),
      z.null(),
      z.undefined(),
    ])
    .optional();

/** UUID opcional: igual, sin transformar cuando está ausente. */
const uuidOpcional = z
  .union([z.string().uuid('El id no es válido'), z.null(), z.undefined()])
  .optional();

/**
 * Ruta de stream: debe empezar por `/` y NO contener credenciales.
 * Se rechaza `rtsp://usuario:clave@host/...` explícitamente.
 */
const rutaStreamBase = z
  .string()
  .min(1, 'La ruta del stream es obligatoria')
  .max(255, 'La ruta del stream no puede superar 255 caracteres')
  .refine((v) => !v.includes('://'), {
    message:
      'Guarde solo la ruta del stream (p. ej. /stream1), no la URL completa. Las credenciales no deben almacenarse aquí.',
  })
  .refine((v) => !v.includes('@'), {
    message: 'La ruta no puede contener credenciales (@)',
  })
  .transform((v) => (v.trim().startsWith('/') ? v.trim() : `/${v.trim()}`));

const rutaStream = rutaStreamBase;

/**
 * Ruta WebRTC en MediaMTX: igual de estricta, sin credenciales.
 * Se aplica el mismo cuidado: ausente ⇒ se deja ausente (no `null`).
 */
const rutaWebrtc = z
  .union([
    z
      .string()
      .max(120, 'La ruta WebRTC no puede superar 120 caracteres')
      .refine((v) => !v.includes('://'), {
        message: 'Indique solo el path en MediaMTX (p. ej. /camara-qui-1)',
      })
      .refine((v) => !v.includes('@'), {
        message: 'La ruta no puede contener credenciales (@)',
      })
      .transform((v) => {
        const limpio = v.trim();
        if (!limpio) return null;
        return limpio.startsWith('/') ? limpio : `/${limpio}`;
      }),
    z.null(),
    z.undefined(),
  ])
  .optional();

/** Dirección IP opcional en formato IPv4 (mismo criterio). */
const direccionIpOpcional = z
  .union([
    z
      .string()
      .regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'La dirección IP no es válida')
      .transform((v) => (v.trim() ? v.trim() : null)),
    z.null(),
    z.undefined(),
  ])
  .optional();

const estadoCamara = z.enum(ESTADOS_CAMARA, {
  message: `El estado debe ser uno de: ${ESTADOS_CAMARA.join(', ')}`,
});

const puertoRtsp = z.coerce
  .number()
  .int('El puerto debe ser un número entero')
  .min(1, 'El puerto debe ser mayor que 0')
  .max(65535, 'El puerto no puede superar 65535');

/** Esquema para crear una cámara. */
export const crearCamaraSchema = z
  .object({
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre no puede superar 120 caracteres'),
    descripcion: textoOpcional(1000),
    area_id: uuidOpcional,
    dispositivo_id: uuidOpcional,
    direccion_ip: direccionIpOpcional,
    puerto_rtsp: puertoRtsp.optional(),
    protocolo: z.string().max(30).optional(),
    ruta_stream: rutaStream,
    ruta_webrtc: rutaWebrtc,
    estado: estadoCamara.optional(),
    activa: z.boolean().optional(),
    grabacion_habilitada: z.boolean().optional(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idCamaraSchema = z.object({
  id: z.string().uuid('El id de la cámara no es válido'),
});

/**
 * Esquema para actualizar una cámara. Todos los campos son opcionales.
 * Reutiliza las mismas validaciones de seguridad.
 */
export const actualizarCamaraSchema = z
  .object({
    nombre: z
      .string()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre no puede superar 120 caracteres')
      .optional(),
    descripcion: textoOpcional(1000),
    area_id: uuidOpcional,
    dispositivo_id: uuidOpcional,
    direccion_ip: direccionIpOpcional,
    puerto_rtsp: puertoRtsp.optional(),
    protocolo: z.string().max(30).optional(),
    ruta_stream: rutaStream.optional(),
    ruta_webrtc: rutaWebrtc,
    estado: estadoCamara.optional(),
    activa: z.boolean().optional(),
    grabacion_habilitada: z.boolean().optional(),
    metadatos: z.record(z.string(), z.unknown()).optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Esquema del endpoint de estado. */
export const actualizarEstadoCamaraSchema = z
  .object({
    estado: estadoCamara,
  })
  .strict();

/** Filtros de listado (query string). */
export const listarCamarasSchema = z.object({
  area_id: z.string().uuid('El id del área no es válido').optional(),
  dispositivo_id: z
    .string()
    .uuid('El id del dispositivo no es válido')
    .optional(),
  estado: estadoCamara.optional(),
  activa: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  buscar: z.string().max(120).optional(),
});

export type CrearCamaraBody = z.infer<typeof crearCamaraSchema>;
export type ActualizarCamaraBody = z.infer<typeof actualizarCamaraSchema>;
export type ActualizarEstadoCamaraBody = z.infer<
  typeof actualizarEstadoCamaraSchema
>;
export type ListarCamarasQuery = z.infer<typeof listarCamarasSchema>;
