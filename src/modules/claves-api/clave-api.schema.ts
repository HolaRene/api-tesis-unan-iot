import { z } from 'zod';

/**
 * Esquemas Zod del módulo de API Keys.
 */

/** Permisos reconocidos inicialmente. */
const permisosReconocidos = [
  'mediciones:crear',
  'comandos:enviar',
  'estado:actualizar',
] as const;

/**
 * Una API Key se crea con nombre, expiración opcional y permisos opcionales.
 * - La clave completa se genera internamente y se muestra una única vez.
 * - Solo se persisten prefijo + hash.
 */
export const crearClaveApiSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  expira_en: z.coerce.date().optional().nullable(),
  activa: z.boolean().optional(),
  // Mapa booleano de permisos, por ejemplo {"mediciones:crear":true}
  permisos: z
    .record(z.string(), z.boolean())
    .refine(
      (p) =>
        Object.keys(p).every(
          (k) => (permisosReconocidos as readonly string[]).includes(k)
        ),
      {
        message: 'Contiene permisos no reconocidos',
      }
    )
    .optional(),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idClaveApiSchema = z.object({
  id: z.string().uuid('El id de la API Key no es válido'),
});

/** Tipos inferidos. */
export type CrearClaveApiBody = z.infer<typeof crearClaveApiSchema>;
