import { z } from 'zod';

const textoOpcional = (max = 100) =>
  z.string().max(max, `No puede superar ${max} caracteres`).optional().nullable()
    .transform((v) => (v?.trim() ? v.trim() : null));

const uuidOpcional = z.string().uuid('No es un id válido').optional().nullable();

export const crearCameraSchema = z.object({
  dispositivo_id: uuidOpcional,
  protocolo: textoOpcional(30),
  ruta_stream: textoOpcional(1000),
  grabacion_habilitada: z.boolean().optional(),
  configuracion: z.record(z.string(), z.unknown()).optional(),
});

export const idCameraSchema = z.object({
  id: z.string().uuid('El id de la cámara no es válido'),
});

export const actualizarCameraSchema = z
  .object({
    dispositivo_id: uuidOpcional,
    protocolo: textoOpcional(30),
    ruta_stream: textoOpcional(1000),
    grabacion_habilitada: z.boolean().optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe proporcionar al menos un campo' });

export type CrearCameraBody = z.infer<typeof crearCameraSchema>;
export type ActualizarCameraBody = z.infer<typeof actualizarCameraSchema>;
