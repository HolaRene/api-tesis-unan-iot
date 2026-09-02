import { query } from '../../database/pool.js';
import type { ActualizarCameraInput, Camera, CrearCameraInput } from './camera.types.js';

const CAMPOS = 'id, dispositivo_id, protocolo, ruta_stream, grabacion_habilitada, configuracion';

export const cameraRepository = {
  async listar(): Promise<Camera[]> {
    const r = await query<Camera>(`SELECT ${CAMPOS} FROM camaras ORDER BY protocolo`);
    return r.rows;
  },
  async buscarPorId(id: string): Promise<Camera | null> {
    const r = await query<Camera>(`SELECT ${CAMPOS} FROM camaras WHERE id = $1 LIMIT 1`, [id]);
    return r.rows[0] ?? null;
  },
  async crear(d: CrearCameraInput): Promise<Camera> {
    const r = await query<Camera>(
      `INSERT INTO camaras (dispositivo_id, protocolo, ruta_stream, grabacion_habilitada, configuracion)
       VALUES ($1, $2, $3, COALESCE($4, FALSE), $5) RETURNING ${CAMPOS}`,
      [d.dispositivo_id ?? null, d.protocolo ?? null, d.ruta_stream ?? null,
       d.grabacion_habilitada ?? null,
       d.configuracion ? JSON.stringify(d.configuracion) : JSON.stringify({})]
    );
    return r.rows[0];
  },
  async actualizar(id: string, d: ActualizarCameraInput): Promise<Camera | null> {
    const sets: string[] = []; const v: unknown[] = []; let i = 1;
    const ag = (c: string, val: unknown) => { sets.push(`${c} = $${i++}`); v.push(val); };
    if (d.dispositivo_id !== undefined) ag('dispositivo_id', d.dispositivo_id);
    if (d.protocolo !== undefined) ag('protocolo', d.protocolo);
    if (d.ruta_stream !== undefined) ag('ruta_stream', d.ruta_stream);
    if (d.grabacion_habilitada !== undefined) ag('grabacion_habilitada', d.grabacion_habilitada);
    if (d.configuracion !== undefined) ag('configuracion', JSON.stringify(d.configuracion));
    if (sets.length === 0) return this.buscarPorId(id);
    v.push(id);
    const r = await query<Camera>(`UPDATE camaras SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${CAMPOS}`, v);
    return r.rows[0] ?? null;
  },
  async eliminar(id: string): Promise<boolean> {
    const r = await query<{ id: string }>('DELETE FROM camaras WHERE id = $1 RETURNING id', [id]);
    return (r.rowCount ?? 0) > 0;
  },
};
