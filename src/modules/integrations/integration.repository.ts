import { query } from '../../database/pool.js';
import type { ActualizarIntegrationInput, Integration, CrearIntegrationInput } from './integration.types.js';

const CAMPOS = 'id, dispositivo_id, plataforma, tipo, id_externo, activo, configuracion, creado_en';

export const integrationRepository = {
  async listar(): Promise<Integration[]> {
    const r = await query<Integration>(`SELECT ${CAMPOS} FROM integraciones ORDER BY creado_en DESC`);
    return r.rows;
  },
  async buscarPorId(id: string): Promise<Integration | null> {
    const r = await query<Integration>(`SELECT ${CAMPOS} FROM integraciones WHERE id = $1 LIMIT 1`, [id]);
    return r.rows[0] ?? null;
  },
  async crear(d: CrearIntegrationInput): Promise<Integration> {
    const r = await query<Integration>(
      `INSERT INTO integraciones (dispositivo_id, plataforma, tipo, id_externo, activo, configuracion)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6) RETURNING ${CAMPOS}`,
      [d.dispositivo_id ?? null, d.plataforma ?? null, d.tipo ?? null, d.id_externo ?? null,
       d.activo ?? null, d.configuracion ? JSON.stringify(d.configuracion) : JSON.stringify({})]
    );
    return r.rows[0];
  },
  async actualizar(id: string, d: ActualizarIntegrationInput): Promise<Integration | null> {
    const sets: string[] = []; const v: unknown[] = []; let i = 1;
    const ag = (c: string, val: unknown) => { sets.push(`${c} = $${i++}`); v.push(val); };
    if (d.dispositivo_id !== undefined) ag('dispositivo_id', d.dispositivo_id);
    if (d.plataforma !== undefined) ag('plataforma', d.plataforma);
    if (d.tipo !== undefined) ag('tipo', d.tipo);
    if (d.id_externo !== undefined) ag('id_externo', d.id_externo);
    if (d.activo !== undefined) ag('activo', d.activo);
    if (d.configuracion !== undefined) ag('configuracion', JSON.stringify(d.configuracion));
    if (sets.length === 0) return this.buscarPorId(id);
    v.push(id);
    const r = await query<Integration>(`UPDATE integraciones SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${CAMPOS}`, v);
    return r.rows[0] ?? null;
  },
  async eliminar(id: string): Promise<boolean> {
    const r = await query<{ id: string }>('DELETE FROM integraciones WHERE id = $1 RETURNING id', [id]);
    return (r.rowCount ?? 0) > 0;
  },
};
