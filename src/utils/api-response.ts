import type { Response } from 'express';

/**
 * Forma estándar de una respuesta exitosa de la API.
 */
export interface RespuestaApi<T> {
  exito: true;
  mensaje?: string;
  datos: T;
}

/**
 * Envía una respuesta exitosa con el formato estándar de la API.
 */
export function responderExito<T>(
  res: Response,
  datos: T,
  statusCode = 200,
  mensaje?: string
): Response {
  const cuerpo: RespuestaApi<T> = {
    exito: true,
    ...(mensaje ? { mensaje } : {}),
    datos,
  };
  return res.status(statusCode).json(cuerpo);
}

/**
 * Forma estándar de una respuesta de error de la API.
 */
export interface RespuestaError {
  exito: false;
  mensaje: string;
  detalles?: unknown;
}

/**
 * Envía una respuesta de error con el formato estándar de la API.
 */
export function responderError(
  res: Response,
  statusCode: number,
  mensaje: string,
  detalles?: unknown
): Response {
  const cuerpo: RespuestaError = {
    exito: false,
    mensaje,
    ...(detalles !== undefined ? { detalles } : {}),
  };
  return res.status(statusCode).json(cuerpo);
}
