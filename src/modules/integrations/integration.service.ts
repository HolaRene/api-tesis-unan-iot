import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type { ActualizarIntegrationInput, Integration, CrearIntegrationInput } from './integration.types.js';
import { integrationRepository } from './integration.repository.js';

export const integrationService = {
  async listar(): Promise<Integration[]> { return integrationRepository.listar(); },
  async obtenerPorId(id: string): Promise<Integration> {
    const c = await integrationRepository.buscarPorId(id);
    if (!c) throw ApiError.notFound('Integración no encontrada');
    return c;
  },
  async crear(e: CrearIntegrationInput): Promise<Integration> {
    if (e.dispositivo_id) { const r = await query<{id:string}>('SELECT id FROM dispositivos WHERE id=$1 LIMIT 1',[e.dispositivo_id]); if(r.rows.length===0) throw ApiError.badRequest('El dispositivo no existe'); }
    return integrationRepository.crear(e);
  },
  async actualizar(id: string, e: ActualizarIntegrationInput): Promise<Integration> {
    if (e.dispositivo_id) { const r = await query<{id:string}>('SELECT id FROM dispositivos WHERE id=$1 LIMIT 1',[e.dispositivo_id]); if(r.rows.length===0) throw ApiError.badRequest('El dispositivo no existe'); }
    const a = await integrationRepository.actualizar(id, e);
    if (!a) throw ApiError.notFound('Integración no encontrada');
    return a;
  },
  async eliminar(id: string): Promise<void> {
    const ok = await integrationRepository.eliminar(id);
    if (!ok) throw ApiError.notFound('Integración no encontrada');
  },
};
