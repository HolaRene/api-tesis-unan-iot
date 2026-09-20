import { query } from '../../database/pool.js';
import type {
  CrearMeasurementInput,
  FiltrarMediciones,
  IntervaloAgregacion,
  Measurement,
  SerieAgregada,
} from './measurement.types.js';
import { esAlcanceTotal, type UsuarioAlcance } from '../../utils/alcance.js';

/** Columnas devueltas en las consultas que mapean a una Medición. */
const CAMPOS_MEDICION = `
  id, sensor_id, canal_id, valor_numerico, valor_texto, valor_booleano, valor_json,
  calidad, registrado_en, metadatos`;

/**
 * Repositorio de mediciones. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const measurementRepository = {
  /**
   * Lista mediciones con filtros opcionales (global).
   * Admite: sensor_id, canal_id, dispositivo_id, area_id, tipo_variable_id,
   * desde, hasta, limite. Permite orden ascendente para historial de gráficas.
   *
   * IMPORTANTE (modelo multivariable): una medición puede venir por `canal_id`
   * con `sensor_id = NULL`. Por eso los JOIN son LEFT y el sensor/tipo se
   * derivan del canal cuando la medición no trae `sensor_id` propio.
   * Un JOIN interno ocultaría todas las mediciones hechas por canal.
   */
  async listar(
    filtro: FiltrarMediciones,
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement[]> {
    const cond: string[] = [];
    const vals: unknown[] = [];
    const nexo = (v: unknown) => {
      vals.push(v);
      return `$${vals.length}`;
    };

    // Sensor efectivo: el propio de la medición o, si no, el del canal.
    const sensorEfectivo = `COALESCE(m.sensor_id, c.sensor_id)`;

    if (filtro.sensor_id !== undefined) {
      cond.push(`${sensorEfectivo} = ${nexo(filtro.sensor_id)}`);
    }
    if (filtro.canal_id !== undefined) {
      cond.push(`m.canal_id = ${nexo(filtro.canal_id)}`);
    }
    if (filtro.dispositivo_id !== undefined) {
      cond.push(`s.dispositivo_id = ${nexo(filtro.dispositivo_id)}`);
    }
    if (filtro.area_id !== undefined) cond.push(`d.area_id = ${nexo(filtro.area_id)}`);
    if (filtro.tipo_variable_id !== undefined) {
      // El tipo puede venir del canal (modelo nuevo) o del sensor (compat).
      cond.push(
        `COALESCE(c.tipo_variable_id, s.tipo_variable_id) = ${nexo(filtro.tipo_variable_id)}`
      );
    }
    if (filtro.desde !== undefined) cond.push(`m.registrado_en >= ${nexo(filtro.desde)}`);
    if (filtro.hasta !== undefined) cond.push(`m.registrado_en <= ${nexo(filtro.hasta)}`);

    // Aislamiento: la medición hereda la propiedad del dispositivo de su canal
    // (o de su sensor, si la medición es antigua y no tiene canal).
    if (!esAlcanceTotal(usuario) && usuario) {
      const u = nexo(usuario.id);
      cond.push(`(d.propietario_id = ${u} OR d.propietario_id IS NULL)`);
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const orden = filtro.orden_ascendente ? 'ASC' : 'DESC';
    const limite = filtro.limite ?? 100;

    const sql = `
      SELECT m.id, ${sensorEfectivo} AS sensor_id, m.canal_id,
             m.valor_numerico, m.valor_texto, m.valor_booleano,
             m.valor_json, m.calidad, m.registrado_en, m.metadatos
      FROM mediciones m
      LEFT JOIN canales c ON c.id = m.canal_id
      LEFT JOIN sensores s ON s.id = ${sensorEfectivo}
      LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
      ${where}
      ORDER BY m.registrado_en ${orden}, m.id ${orden}
      LIMIT ${nexo(limite)}
    `;

    const r = await query<Measurement>(sql, vals);
    return r.rows;
  },

  /**
   * Lista el historial de un solo sensor (orden ascendente para gráfica),
   * permitiendo filtros desde/hasta y limite.
   *
   * Incluye las mediciones hechas por cualquiera de sus canales (modelo
   * multivariable), donde `sensor_id` puede ser NULL.
   */
  async listarHistorialSensor(sensorId: string, filtro: { desde?: string; hasta?: string; limite?: number } = {}): Promise<Measurement[]> {
    const cond = [
      `(m.sensor_id = $1 OR m.canal_id IN (SELECT id FROM canales WHERE sensor_id = $1))`,
    ];
    const vals: unknown[] = [sensorId];
    let indice = 2;
    if (filtro.desde !== undefined) { cond.push(`m.registrado_en >= $${indice++}`); vals.push(filtro.desde); }
    if (filtro.hasta !== undefined) { cond.push(`m.registrado_en <= $${indice++}`); vals.push(filtro.hasta); }
    const limite = filtro.limite ?? 100;

    const r = await query<Measurement>(
      `SELECT m.id, COALESCE(m.sensor_id, c.sensor_id) AS sensor_id, m.canal_id,
              m.valor_numerico, m.valor_texto, m.valor_booleano, m.valor_json,
              m.calidad, m.registrado_en, m.metadatos
       FROM mediciones m
       LEFT JOIN canales c ON c.id = m.canal_id
       WHERE ${cond.join(' AND ')}
       ORDER BY m.registrado_en ASC, m.id ASC
       LIMIT $${indice}`,
      [...vals, limite]
    );
    return r.rows;
  },

  /**
   * Lista el historial de un canal (orden ascendente para gráfica).
   */
  async listarHistorialCanal(canalId: string, filtro: { desde?: string; hasta?: string; limite?: number } = {}): Promise<Measurement[]> {
    const cond = ['canal_id = $1'];
    const vals: unknown[] = [canalId];
    let indice = 2;
    if (filtro.desde !== undefined) { cond.push(`registrado_en >= $${indice++}`); vals.push(filtro.desde); }
    if (filtro.hasta !== undefined) { cond.push(`registrado_en <= $${indice++}`); vals.push(filtro.hasta); }
    const limite = filtro.limite ?? 100;
    const r = await query<Measurement>(
      `SELECT ${CAMPOS_MEDICION} FROM mediciones
       WHERE ${cond.join(' AND ')}
       ORDER BY registrado_en ASC, id ASC
       LIMIT $${indice}`,
      [...vals, limite]
    );
    return r.rows;
  },

  /**
   * Busca una medición por id, solo si es visible para el usuario.
   * Sin `usuario` (o con `null`) no filtra: uso interno (IoT).
   */
  async buscarPorId(
    id: number,
    usuario?: UsuarioAlcance | null
  ): Promise<Measurement | null> {
    if (!usuario || esAlcanceTotal(usuario)) {
      const resultado = await query<Measurement>(
        `SELECT ${CAMPOS_MEDICION} FROM mediciones WHERE id = $1 LIMIT 1`,
        [id]
      );
      return resultado.rows[0] ?? null;
    }

    const resultado = await query<Measurement>(
      `SELECT m.id, m.sensor_id, m.canal_id, m.valor_numerico, m.valor_texto,
              m.valor_booleano, m.valor_json, m.calidad, m.registrado_en, m.metadatos
       FROM mediciones m
       LEFT JOIN canales c ON c.id = m.canal_id
       LEFT JOIN sensores s ON s.id = COALESCE(m.sensor_id, c.sensor_id)
       LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
       WHERE m.id = $1
         AND (d.propietario_id = $2 OR d.propietario_id IS NULL)
       LIMIT 1`,
      [id, usuario.id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Inserta una medición y devuelve el registro creado.
   * Si no se indica registrado_en, PostgreSQL usa NOW() por defecto.
   */
  async crear(datos: CrearMeasurementInput): Promise<Measurement> {
    const resultado = await query<Measurement>(
      `INSERT INTO mediciones
         (canal_id, sensor_id, valor_numerico, valor_texto, valor_booleano, valor_json,
          calidad, registrado_en, metadatos)
       VALUES
         ($1, $2, $3, $4, $5, $6, COALESCE($7, 'good'), COALESCE($8, NOW()), $9)
       RETURNING ${CAMPOS_MEDICION}`,
      [
        datos.canal_id ?? null,
        datos.sensor_id ?? null,
        datos.valor_numerico ?? null,
        datos.valor_texto ?? null,
        datos.valor_booleano ?? null,
        datos.valor_json ? JSON.stringify(datos.valor_json) : null,
        datos.calidad ?? 'good',
        datos.registrado_en ?? null,
        datos.metadatos ? JSON.stringify(datos.metadatos) : JSON.stringify({}),
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Elimina una medición por id. Devuelve true si existía.
   */
  async eliminar(id: number): Promise<boolean> {
    const resultado = await query<{ id: number }>(
      'DELETE FROM mediciones WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },

  /**
   * SERIES AGREGADAS por intervalo de tiempo.
   *
   * Agrupa las mediciones numéricas con `date_trunc` y devuelve estadísticas
   * por cubo temporal. Esto evita transferir miles de filas al navegador:
   * con un mes de datos cada 5 s serían ~500.000 filas; agregadas por hora,
   * 720 puntos.
   *
   * IMPORTANTE: `intervalo` NUNCA se interpola directamente en el SQL (viene
   * de la query string). Se valida contra una lista blanca y se mapea a un
   * literal fijo, evitando inyección.
   *
   * @param filtro  ids y rango temporal
   * @param intervalo 'hora' | 'dia' | 'semana' | 'mes'
   * @param usuario alcance de datos (null/undefined = sin filtro)
   */
  async seriesAgregadas(
    filtro: {
      sensor_id?: string;
      canal_id?: string;
      dispositivo_id?: string;
      area_id?: string;
      desde?: string;
      hasta?: string;
    },
    intervalo: IntervaloAgregacion,
    usuario?: UsuarioAlcance | null,
    limiteCubos = 1000
  ): Promise<SerieAgregada[]> {
    // Lista blanca: el valor se resuelve aquí, nunca llega del cliente.
    const TRUNCS: Record<IntervaloAgregacion, string> = {
      minuto: 'minute',
      hora: 'hour',
      dia: 'day',
      semana: 'week',
      mes: 'month',
    };
    const trunc = TRUNCS[intervalo];

    const cond: string[] = [];
    const vals: unknown[] = [];
    const nexo = (v: unknown) => {
      vals.push(v);
      return `$${vals.length}`;
    };

    // Solo valores numéricos: las series temporales agregadas aplican a
    // magnitudes continuas (temperatura, humedad…).
    cond.push('m.valor_numerico IS NOT NULL');

    const sensorEfectivo = `COALESCE(m.sensor_id, c.sensor_id)`;

    if (filtro.sensor_id !== undefined) {
      cond.push(`${sensorEfectivo} = ${nexo(filtro.sensor_id)}`);
    }
    if (filtro.canal_id !== undefined) {
      cond.push(`m.canal_id = ${nexo(filtro.canal_id)}`);
    }
    if (filtro.dispositivo_id !== undefined) {
      cond.push(`s.dispositivo_id = ${nexo(filtro.dispositivo_id)}`);
    }
    if (filtro.area_id !== undefined) {
      cond.push(`d.area_id = ${nexo(filtro.area_id)}`);
    }
    if (filtro.desde !== undefined) {
      cond.push(`m.registrado_en >= ${nexo(filtro.desde)}`);
    }
    if (filtro.hasta !== undefined) {
      cond.push(`m.registrado_en <= ${nexo(filtro.hasta)}`);
    }

    // Aislamiento por propietario del dispositivo (igual que el resto).
    if (!esAlcanceTotal(usuario) && usuario) {
      const u = nexo(usuario.id);
      cond.push(`(d.propietario_id = ${u} OR d.propietario_id IS NULL)`);
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const sql = `
      SELECT
        date_trunc('${trunc}', m.registrado_en) AS cubo,
        avg(m.valor_numerico)  AS media,
        min(m.valor_numerico)  AS minimo,
        max(m.valor_numerico)  AS maximo,
        stddev_samp(m.valor_numerico) AS desviacion,
        count(*)::int          AS muestras
      FROM mediciones m
      LEFT JOIN canales c ON c.id = m.canal_id
      LEFT JOIN sensores s ON s.id = ${sensorEfectivo}
      LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
      ${where}
      GROUP BY cubo
      ORDER BY cubo ASC
      LIMIT ${nexo(limiteCubos)}
    `;

    const r = await query<SerieAgregada>(sql, vals);
    return r.rows;
  },
};
