import { z } from 'zod';

/**
 * Esquemas Zod del módulo de usuarios.
 */

/** Roles válidos dentro del sistema. */
export const rolesValidos = ['viewer', 'usuario', 'admin'] as const;

/** Esquema para registrarse (self-signup). Siempre crea como viewer. */
export const crearUsuarioSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  email: z.string().email('El email no es válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar 72 caracteres'),
});

/**
 * Esquema para que un admin cree/invite un usuario con rol asignable.
 */
export const crearUsuarioAdminSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  email: z.string().email('El email no es válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar 72 caracteres'),
  rol: z.enum(rolesValidos).default('viewer'),
});

/** Esquema para iniciar sesión. */
export const loginSchema = z.object({
  email: z.string().email('El email no es válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

/** Esquema para el parámetro de ruta `:id` (UUID). */
export const idUsuarioSchema = z.object({
  id: z.string().uuid('El id del usuario no es válido'),
});

/**
 * Esquema para actualizar un usuario (solo admin). Todos los campos son
 * opcionales, pero al menos uno debe estar presente.
 */
export const actualizarUsuarioSchema = z
  .object({
    nombre: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede superar 100 caracteres')
      .optional(),
    email: z.string().email('El email no es válido').optional(),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(72, 'La contraseña no puede superar 72 caracteres')
      .optional(),
    rol: z.enum(rolesValidos).optional(),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar',
  });

/** Tipo inferido del esquema de creación pública (viewer). */
export type CrearUsuarioBody = z.infer<typeof crearUsuarioSchema>;

/** Tipo inferido del esquema de creación por admin. */
export type CrearUsuarioAdminBody = z.infer<typeof crearUsuarioAdminSchema>;

/** Tipo inferido del esquema de login. */
export type LoginBody = z.infer<typeof loginSchema>;

/** Tipo inferido del esquema de actualización. */
export type ActualizarUsuarioBody = z.infer<typeof actualizarUsuarioSchema>;
