/**
 * Tipos del módulo de comandos de actuadores.
 */

/** Estados posibles del comando. */
export type EstadoComandoActuador =
  | 'pendiente'
  | 'enviado'
  | 'ejecutado'
  | 'fallido'
  | 'cancelado';

export interface ComandoActuador {
  id: string;
  actuador_id: string;
  usuario_id: string | null;
  clave_api_id: string | null;
  comando: string;
  valor: Record<string, unknown> | null;
  estado: EstadoComandoActuador | string;
  creado_en: Date;
  enviado_en: Date | null;
  ejecutado_en: Date | null;
  respuesta: Record<string, unknown> | null;
  metadatos: Record<string, unknown> | null;
}

/** Comando con relación al actuador y origen legible (para consultar). */
export interface ComandoActuadorConRelaciones extends ComandoActuador {
  actuador_codigo: string | null;
  actuador_nombre: string | null;
  dispositivo_id: string | null;
  /** Tema MQTT donde Node-RED debe publicar la orden (puede ser NULL). */
  actuador_topico_mqtt: string | null;
  /** Estado actual del actuador ('on', 'off'…), para comparar con la orden. */
  actuador_estado_actual: string | null;
  actuador_tipo: string | null;
  dispositivo_nombre: string | null;
  dispositivo_identificador: string | null;
  area_nombre: string | null;
  clave_api_nombre: string | null;
}

/**
 * Confirmación que envía la integración (Node-RED) al entregar un comando.
 *
 * `estado` refleja el resultado real, no lo que se pretendía:
 *   - 'enviado'   → se publicó en MQTT, pero el equipo aún no ha confirmado.
 *   - 'ejecutado' → el equipo confirmó que aplicó la orden.
 *   - 'fallido'   → no se pudo entregar (equipo offline, error de red…).
 */
export interface ConfirmarComandoInput {
  estado: 'enviado' | 'ejecutado' | 'fallido';
  /** Respuesta del equipo (opcional). Se guarda tal cual. */
  respuesta?: Record<string, unknown>;
  /** Nuevo estado del actuador si la orden se ejecutó (p. ej. 'on', 'off'). */
  estado_actuador?: string;
}

/**
 * Comando creado desde la WEB (JWT): registramos usuario_id.
 */
export interface CrearComandoWebInput {
  actuador_id: string;
  usuario_id: string;
  comando: string;
  valor?: Record<string, unknown>;
  metadatos?: Record<string, unknown>;
}

/**
 * Comando creado desde una INTEGRACIÓN (API Key): registramos clave_api_id,
 * y además se resuelve el actuador por código.
 */
export interface CrearComandoIntegracionInput {
  clave_api_id: string;
  actuadorCodigo: string;
  comando: string;
  valor?: Record<string, unknown> | boolean | number | string;
  metadatos?: Record<string, unknown>;
}
