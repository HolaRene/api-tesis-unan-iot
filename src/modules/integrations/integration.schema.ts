import { z } from 'zod';

const textoOpcional = (max = 100) =>
  z.string().max(max, `No puede superar ${max} caracteres`).optional().nullable()
    .transform((v) => (v?.trim() ? v.trim() : null));

const uuidOpcional = z.string().uuid('No es un id válido').optional().nullable();

export const crearIntegrationSchema = z.object({
  dispositivo_id: uuidOpcional,
  plataforma: textoOpcional(50),
  tipo: textoOpcional(50),
  id_externo: textoOpcional(255),
  activo: z.boolean().optional(),
  configuracion: z.record(z.string(), z.unknown()).optional(),
});

export const idIntegrationSchema = z.object({
  id: z.string().uuid('El id de la integración no es válido'),
});

export const actualizarIntegrationSchema = z
  .object({
    dispositivo_id: uuidOpcional,
    plataforma: textoOpcional(50),
    tipo: textoOpcional(50),
    id_externo: textoOpcional(255),
    activo: z.boolean().optional(),
    configuracion: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe proporcionar al menos un campo' });

export type CrearIntegrationBody = z.infer<typeof crearIntegrationSchema>;
export type ActualizarIntegrationBody = z.infer<typeof actualizarIntegrationSchema>;
