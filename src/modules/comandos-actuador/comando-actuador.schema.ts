import { z } from 'zod';

/**
 * Esquemas Zod del módulo de comandos de actuadores.
 */

/** Esquema para registrar un comando desde la WEB (JWT).
 * El actuador va en la URL (`/actuadores/:id/comandos`); el body solo
 * lleva `comando`, `valor` (opcional) y `metadatos`.
 */
export const crearComandoWebSchema = z.object({
  comando: z.string().min(1, 'El comando es obligatorio').max(100, 'El comando no puede superar 100 caracteres'),
  valor: z.any().optional(),
  metadatos: z.record(z.string(), z.unknown()).optional(),
});

/** Esquema para consultar comandos de un actuador (query). */
export const listarComandosSchema = z.object({
  limite: z.coerce.number().int().positive().max(200).optional(),
});

/** Esquema del parámetro de ruta de actuador id. */
export const idActuadorParamSchema = z.object({
  id: z.string().uuid('El id del actuador no es válido'),
});

export type CrearComandoWebBody = z.infer<typeof crearComandoWebSchema>;
