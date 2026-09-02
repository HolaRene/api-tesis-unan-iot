/**
 * Tipos del módulo de integraciones.
 */

export interface Integration {
  id: string;
  dispositivo_id: string | null;
  plataforma: string | null;
  tipo: string | null;
  id_externo: string | null;
  activo: boolean;
  configuracion: Record<string, unknown> | null;
  creado_en: Date;
}

export interface CrearIntegrationInput {
  dispositivo_id?: string | null;
  plataforma?: string | null;
  tipo?: string | null;
  id_externo?: string | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}

export interface ActualizarIntegrationInput {
  dispositivo_id?: string | null;
  plataforma?: string | null;
  tipo?: string | null;
  id_externo?: string | null;
  activo?: boolean;
  configuracion?: Record<string, unknown>;
}
