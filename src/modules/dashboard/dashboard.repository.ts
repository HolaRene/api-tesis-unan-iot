import { query } from '../../database/pool.js';
import type {
  MedicionResumen,
  ResumenDashboard,
  Totales,
} from './dashboard.types.js';
import { esAlcanceTotal, type UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Repositorio del dashboard/resumen. Centraliza en pocas consultas la
 * información que consume la vista principal (evita N llamadas al cliente).
 *
 * AISLAMIENTO: todo se filtra por el propietario del DISPOSITIVO del recurso.
 *   - admin → ve todo (sin filtro)
 *   - resto → lo suyo + lo global (`propietario_id IS NULL`)
 */
export const dashboardRepository = {
  /**
   * Construye el resumen completo del dashboard, limitado a lo visible para
   * el usuario.
   */
  async resumen(
    limiteMediciones = 10,
    limiteAlertas = 10,
    usuario?: UsuarioAlcance | null
  ): Promise<ResumenDashboard> {
    const total = esAlcanceTotal(usuario);
    // `$1` = id del usuario cuando hay filtro; si es admin no se usa.
    const params: unknown[] = [usuario?.id ?? null];
    const filtroDueno = total
      ? ''
      : 'WHERE (d.propietario_id = $1 OR d.propietario_id IS NULL)';

    const totalesRes = await query<{ clave: string; cantidad: number }>(
      `SELECT 'areas' clave, count(*) cantidad
         FROM areas a
         ${total ? '' : 'WHERE (a.propietario_id = $1 OR a.propietario_id IS NULL)'}
       UNION ALL
       SELECT 'dispositivos', count(*)
         FROM dispositivos d
         ${filtroDueno}
       UNION ALL
       SELECT 'sensores', count(*)
         FROM sensores s
         LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
         ${filtroDueno}
       UNION ALL
       SELECT 'mediciones', count(*)
         FROM mediciones m
         LEFT JOIN canales c ON c.id = m.canal_id
         LEFT JOIN sensores s ON s.id = COALESCE(m.sensor_id, c.sensor_id)
         LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
         ${filtroDueno}
       UNION ALL
       SELECT 'alertas_activas', count(*)
         FROM alertas al
         LEFT JOIN canales c ON c.id = al.canal_id
         LEFT JOIN sensores s ON s.id = COALESCE(al.sensor_id, c.sensor_id)
         LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
         WHERE al.estado = 'active'
         ${total ? '' : 'AND (d.propietario_id = $1 OR d.propietario_id IS NULL)'}
      `,
      total ? [] : params
    );
    const cant = Object.fromEntries(totalesRes.rows.map((r) => [r.clave, Number(r.cantidad)]));
    const totales: Totales = {
      areas: cant.areas ?? 0,
      dispositivos: cant.dispositivos ?? 0,
      sensores: cant.sensores ?? 0,
      mediciones: cant.mediciones ?? 0,
      alertas_activas: cant.alertas_activas ?? 0,
    };

    // Últimas mediciones con su sensor legible (incluye id del sensor).
    // Se usa LEFT JOIN + COALESCE para no ocultar las mediciones por canal.
    const medicionesRes = await query<MedicionResumen>(
      `SELECT m.id, COALESCE(m.sensor_id, c.sensor_id) AS sensor_id,
              m.valor_numerico, m.valor_texto, m.valor_booleano,
              m.valor_json, m.calidad, m.registrado_en,
              COALESCE(s.codigo, c.codigo) AS sensor_codigo,
              COALESCE(s.nombre, c.nombre) AS sensor_nombre,
              COALESCE(s.unidad, c.unidad) AS unidad,
              d.nombre AS dispositivo_nombre
       FROM mediciones m
       LEFT JOIN canales c ON c.id = m.canal_id
       LEFT JOIN sensores s ON s.id = COALESCE(m.sensor_id, c.sensor_id)
       LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
       ${filtroDueno}
       ORDER BY m.registrado_en DESC
       LIMIT $2`,
      total ? [null, limiteMediciones] : [usuario?.id ?? null, limiteMediciones]
    );

    const dispositivosRes = await query(
      `SELECT d.id, d.nombre, d.estado, d.area_id, d.ultima_conexion, d.creado_en
       FROM dispositivos d
       ${filtroDueno}
       ORDER BY COALESCE(d.ultima_conexion, d.creado_en) DESC
       LIMIT 5`,
      total ? [] : params
    );

    const alertasRes = await query(
      `SELECT a.id, a.severidad, a.mensaje, a.estado, a.iniciada_en,
              COALESCE(s.codigo, c.codigo) AS sensor_codigo
       FROM alertas a
       LEFT JOIN canales c ON c.id = a.canal_id
       LEFT JOIN sensores s ON s.id = COALESCE(a.sensor_id, c.sensor_id)
       LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
       ${filtroDueno}
       ORDER BY a.iniciada_en DESC
       LIMIT $2`,
      total ? [null, limiteAlertas] : [usuario?.id ?? null, limiteAlertas]
    );

    return {
      totales,
      ultimas_mediciones: medicionesRes.rows,
      dispositivos_recientes: dispositivosRes.rows,
      ultimas_alertas: alertasRes.rows,
    };
  },
};
