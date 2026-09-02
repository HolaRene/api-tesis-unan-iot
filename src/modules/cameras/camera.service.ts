import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type { ActualizarCameraInput, Camera, CrearCameraInput } from './camera.types.js';
import { cameraRepository } from './camera.repository.js';

export const cameraService = {
  async listar(): Promise<Camera[]> { return cameraRepository.listar(); },
  async obtenerPorId(id: string): Promise<Camera> {
    const c = await cameraRepository.buscarPorId(id);
    if (!c) throw ApiError.notFound('Cámara no encontrada');
    return c;
  },
  async crear(e: CrearCameraInput): Promise<Camera> {
    if (e.dispositivo_id) { const r = await query<{id:string}>('SELECT id FROM dispositivos WHERE id=$1 LIMIT 1',[e.dispositivo_id]); if(r.rows.length===0) throw ApiError.badRequest('El dispositivo no existe'); }
    return cameraRepository.crear(e);
  },
  async actualizar(id: string, e: ActualizarCameraInput): Promise<Camera> {
    if (e.dispositivo_id) { const r = await query<{id:string}>('SELECT id FROM dispositivos WHERE id=$1 LIMIT 1',[e.dispositivo_id]); if(r.rows.length===0) throw ApiError.badRequest('El dispositivo no existe'); }
    const a = await cameraRepository.actualizar(id, e);
    if (!a) throw ApiError.notFound('Cámara no encontrada');
    return a;
  },
  async eliminar(id: string): Promise<void> {
    const ok = await cameraRepository.eliminar(id);
    if (!ok) throw ApiError.notFound('Cámara no encontrada');
  },
};
