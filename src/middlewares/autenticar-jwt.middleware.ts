/**
 * Middleware de autenticación JWT para usuarios humanos (panel web, frontend).
 *
 * Reexporta la implementación existente (`auth.middleware.ts`) bajo un nombre
 * explícito para documentar su uso en rutas de usuario/web. No duplica lógica:
 * modificar `auth.middleware.ts` se refleja aquí.
 */
export { middlewareAuth as autenticarJWT } from './auth.middleware.js';
