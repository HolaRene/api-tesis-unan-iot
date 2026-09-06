import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';
import { claveApiService } from '../modules/claves-api/clave-api.service.js';

/**
 * Middleware de autenticación por API Key para integraciones (Node-RED, scripts,
 * gateways, clientes IoT).
 *
 * Lee el encabezado `X-API-Key`:
 *  1. valida formato
 *  2. localiza la clave por prefijo
 *  3. verifica el hash
 *  4. comprueba activa y expiración
 *  5. actualiza ultimo_uso
 *  6. adjunta `req.claveApi` con claveApiId, usuarioId y permisos
 */
export async function autenticarApiKey(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const claveEnTexto = req.headers['x-api-key'];

  if (!claveEnTexto || typeof claveEnTexto !== 'string' || claveEnTexto.trim() === '') {
    next(
      new ApiError(401, 'Falta el encabezado X-API-Key', {
        codigo: 'API_KEY_FALTANTE',
      })
    );
    return;
  }

  const resultado = await claveApiService.verificarClaveEnTexto(claveEnTexto.trim());

  if (!resultado) {
    next(
      new ApiError(401, 'La API Key no es válida o está inactiva', {
        codigo: 'API_KEY_INVALIDA',
      })
    );
    return;
  }

  // Adjunta la integración autenticada
  req.claveApi = resultado;
  next();
}
