/**
 * Repositorio de normas (plantillas de alerta).
 *
 * Contiene solo SQL. La lógica de negocio vive en `plantilla-alerta.service`.
 *
 * Las reglas se guardan como JSONB en la propia fila: una norma no es una
 * regla activa de ningún canal, es una DEFINICIÓN que se copia a
 * `reglas_alerta` cuando se aplica a un área.
 */
import { query } from '../../database/pool.js';
import type { PlantillaAlerta } from './plantilla-alerta.service.js';

/** Columnas que se devuelven siempre. */
const CAMPOS = `
  id, nombre, descripcion, norma, notas, reglas,
  origen, activo, creado_en, actualizado_en
`;

export interface FilaPlantilla {
  id: string;
  nombre: string;
  descripcion: string | null;
  norma: string;
  notas: unknown;
  reglas: unknown;
  origen: 'sistema' | 'usuario';
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
}

/** Convierte la fila de PostgreSQL al tipo que usa la API. */
export function aPlantilla(fila: FilaPlantilla): PlantillaAlerta & {
  origen: 'sistema' | 'usuario';
  activo: boolean;
} {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? '',
    norma: fila.norma,
    notas: Array.isArray(fila.notas) ? (fila.notas as string[]) : [],
    reglas: Array.isArray(fila.reglas)
      ? (fila.reglas as PlantillaAlerta['reglas'])
      : [],
    origen: fila.origen,
    activo: fila.activo,
  };
}

export const plantillaRepository = {
  /** Todas las normas activas, de sistema primero. */
  async listar(): Promise<(PlantillaAlerta & { origen: string })[]> {
    const r = await query<FilaPlantilla>(
      `SELECT ${CAMPOS} FROM plantillas_alerta
        WHERE activo = TRUE
        ORDER BY origen DESC, nombre ASC`
    );
    return r.rows.map(aPlantilla) as (PlantillaAlerta & { origen: string })[];
  },

  async buscarPorId(
    id: string
  ): Promise<(PlantillaAlerta & { origen: string }) | null> {
    const r = await query<FilaPlantilla>(
      `SELECT ${CAMPOS} FROM plantillas_alerta WHERE id = $1`,
      [id]
    );
    return r.rows[0] ? (aPlantilla(r.rows[0]) as PlantillaAlerta & { origen: string }) : null;
  },

  async existe(id: string): Promise<boolean> {
    const r = await query(`SELECT 1 FROM plantillas_alerta WHERE id = $1`, [id]);
    return (r.rowCount ?? 0) > 0;
  },

  /**
   * Inserta o actualiza una norma de SISTEMA (sembrado desde JSON).
   *
   * Solo actualiza si ya era de sistema: si un administrador cambió una
   * norma sembrada, el sembrado NO debe pisar sus ajustes en cada arranque.
   */
  async sembrar(plantilla: PlantillaAlerta): Promise<void> {
    await query(
      `INSERT INTO plantillas_alerta
         (id, nombre, descripcion, norma, notas, reglas, origen, activo)
       VALUES ($1,$2,$3,$4,$5,$6,'sistema',TRUE)
       ON CONFLICT (id) DO UPDATE SET
         nombre         = EXCLUDED.nombre,
         descripcion    = EXCLUDED.descripcion,
         norma          = EXCLUDED.norma,
         notas          = EXCLUDED.notas,
         reglas         = EXCLUDED.reglas,
         actualizado_en = NOW()
       WHERE plantillas_alerta.origen = 'sistema'`,
      [
        plantilla.id,
        plantilla.nombre,
        plantilla.descripcion ?? null,
        plantilla.norma,
        JSON.stringify(plantilla.notas ?? []),
        JSON.stringify(plantilla.reglas ?? []),
      ]
    );
  },

  async crear(datos: {
    id: string;
    nombre: string;
    descripcion: string | null;
    norma: string;
    notas: string[];
    reglas: unknown[];
  }): Promise<PlantillaAlerta & { origen: string }> {
    const r = await query<FilaPlantilla>(
      `INSERT INTO plantillas_alerta
         (id, nombre, descripcion, norma, notas, reglas, origen, activo)
       VALUES ($1,$2,$3,$4,$5,$6,'usuario',TRUE)
       RETURNING ${CAMPOS}`,
      [
        datos.id,
        datos.nombre,
        datos.descripcion,
        datos.norma,
        JSON.stringify(datos.notas),
        JSON.stringify(datos.reglas),
      ]
    );
    return aPlantilla(r.rows[0]!) as PlantillaAlerta & { origen: string };
  },

  async actualizar(
    id: string,
    datos: {
      nombre?: string;
      descripcion?: string | null;
      norma?: string;
      notas?: string[];
      reglas?: unknown[];
    }
  ): Promise<PlantillaAlerta & { origen: string } | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let i = 1;

    if (datos.nombre !== undefined) {
      sets.push(`nombre = $${i++}`);
      valores.push(datos.nombre);
    }
    if (datos.descripcion !== undefined) {
      sets.push(`descripcion = $${i++}`);
      valores.push(datos.descripcion);
    }
    if (datos.norma !== undefined) {
      sets.push(`norma = $${i++}`);
      valores.push(datos.norma);
    }
    if (datos.notas !== undefined) {
      sets.push(`notas = $${i++}`);
      valores.push(JSON.stringify(datos.notas));
    }
    if (datos.reglas !== undefined) {
      sets.push(`reglas = $${i++}`);
      valores.push(JSON.stringify(datos.reglas));
    }

    if (sets.length === 0) return this.buscarPorId(id);

    sets.push('actualizado_en = NOW()');
    valores.push(id);

    const r = await query<FilaPlantilla>(
      `UPDATE plantillas_alerta SET ${sets.join(', ')}
        WHERE id = $${i} RETURNING ${CAMPOS}`,
      valores
    );
    return r.rows[0] ? (aPlantilla(r.rows[0]) as PlantillaAlerta & { origen: string }) : null;
  },

  /**
   * Borra una norma.
   *
   * Solo las de origen `usuario`. Las de sistema devuelven 0 filas: la
   * restricción está en el propio SQL para que no dependa de que el servicio
   * se acuerde de comprobarlo.
   */
  async eliminar(id: string): Promise<boolean> {
    const r = await query(
      `DELETE FROM plantillas_alerta WHERE id = $1 AND origen = 'usuario'`,
      [id]
    );
    return (r.rowCount ?? 0) > 0;
  },
};
