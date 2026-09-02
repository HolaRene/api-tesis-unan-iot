import { z } from 'zod';

/**
 * Esquemas compartidos reutilizados por varios módulos.
 */

/**
 * Esquema de paginación. Se utiliza para validar los parámetros de
 * consulta `page` y `pageSize` de los endpoints que devuelven listas.
 */
export const paginacionSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive('El número de página debe ser positivo')
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive('El tamaño de página debe ser positivo')
    .max(100, 'El tamaño de página no puede superar 100')
    .default(20),
});

/** Tipo inferido del esquema de paginación. */
export type Paginacion = z.infer<typeof paginacionSchema>;

/**
 * Calcula los valores de desplazamiento para una consulta SQL paginada.
 */
export function calcularPaginacion(paginacion: Paginacion): {
  limite: number;
  offset: number;
} {
  const { page, pageSize } = paginacion;
  return {
    limite: pageSize,
    offset: (page - 1) * pageSize,
  };
}
