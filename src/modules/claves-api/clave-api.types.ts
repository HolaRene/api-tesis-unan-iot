/**
 * Tipos del módulo de API Keys.
 */

/**
 * Permisos que puede tener una API Key.
 * Son ampliables; no se usan como única capa rígida.
 */
export interface PermisosClaveApi {
  'mediciones:crear'?: boolean;
  'comandos:enviar'?: boolean;
  'estado:actualizar'?: boolean;
  [permiso: string]: boolean | undefined;
}

/**
 * Representa una API Key tal como se almacena (sin el valor completo).
 * Solo disponemos de un prefijo visible y del hash.
 */
export interface ClaveApi {
  id: string;
  usuario_id: string;
  nombre: string;
  prefijo: string;
  hash_clave: string;
  activa: boolean;
  permisos: PermisosClaveApi | null;
  ultimo_uso: Date | null;
  expira_en: Date | null;
  creado_en: Date;
}

/** Clave API sin campos sensibles, apta para devolver al frontend. */
export interface ClaveApiSegura {
  id: string;
  usuario_id: string;
  nombre: string;
  prefijo: string;
  activa: boolean;
  permisos: PermisosClaveApi | null;
  ultimo_uso: Date | null;
  expira_en: Date | null;
  creado_en: Date;
}

/**
 * Información de la integración autenticada que se adjunta en `req.integracion`
 * tras validar una API Key (middleware autenticar-api-key).
 */
export interface IntegracionApiKey {
  claveApiId: string;
  usuarioId: string;
  permisos: PermisosClaveApi;
  claveApiNombre?: string;
}

/** Datos para crear una API key desde la web. */
export interface CrearClaveApiInput {
  usuario_id: string;
  nombre: string;
  expira_en?: Date | null;
  permisos?: PermisosClaveApi;
}

/** Resultado de la creación: incluye la clave completa (una única vez). */
export interface ClaveApiCreada {
  clave: ClaveApiSegura;
  claveCompleta: string;
  prefijo: string;
}
