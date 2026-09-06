import { query } from '../../database/pool.js';
import type {
  MedicionResumen,
  ResumenDashboard,
  Totales,
} from './dashboard.types.js';

/**
 * Repositorio del dashboard/resumen. Centraliza en pocas consultas la
 * información que consume la vista principal (evita N llamadas al cliente).
 */
export const dashboardRepository = {
  /**
   * Construye el resumen completo del dashboard.
   * La medición trae su sensor (id + código) para saber a qué medición
   * corresponde (trazabilidad código -> sensor_id -> medicion).
   */
  async resumen(limiteMediciones = 10, limiteAlertas = 10): Promise<ResumenDashboard> {
    const totalesRes = await query<{ clave: string; cantidad: number }>(
      `SELECT 'areas' clave, count(*) cantidad FROM areas
       UNION ALL SELECT 'dispositivos', count(*) FROM dispositivos
       UNION ALL SELECT 'sensores', count(*) FROM sensores
       UNION ALL SELECT 'mediciones', count(*) FROM mediciones
       UNION ALL SELECT 'alertas_activas', count(*) FROM alertas WHERE estado = 'active'
      `
    );
    const cant = Object.fromEntries(totalesRes.rows.map((r) => [r.clave, Number(r.cantidad)]));
    const totales: Totales = {
      areas: cant.areas ?? 0,
      dispositivos: cant.dispositivos ?? 0,
      sensores: cant.sensores ?? 0,
      mediciones: cant.mediciones ?? 0,
      alertas_activas: cant.alertas_activas ?? 0,
    };

    // Últimas mediciones con su sensor legible (incluye id del sensor)
    const medicionesRes = await query<MedicionResumen>(
      `SELECT m.id, m.sensor_id, m.valor_numerico, m.valor_texto, m.valor_booleano,
              m.valor_json, m.calidad, m.registrado_en,
              s.codigo AS sensor_codigo, s.nombre AS sensor_nombre, s.unidad,
              d.nombre AS dispositivo_nombre
       FROM mediciones m
       JOIN sensores s ON s.id = m.sensor_id
       LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
       ORDER BY m.registrado_en DESC
       LIMIT $1`,
      [limiteMediciones]
    );

    const dispositivosRes = await query(
      `SELECT id, nombre, estado, area_id, ultima_conexion, creado_en
       FROM dispositivos
       ORDER BY COALESCE(ultima_conexion, creado_en) DESC
       LIMIT 5`
    );

    const alertasRes = await query(
      `SELECT a.id, a.severidad, a.mensaje, a.estado, a.iniciada_en,
              s.codigo AS sensor_codigo
       FROM alertas a
       LEFT JOIN sensores s ON s.id = a.sensor_id
       ORDER BY a.iniciada_en DESC
       LIMIT $1`,
      [limiteAlertas]
    );

    return {
      totales,
      ultimas_mediciones: medicionesRes.rows,
      dispositivos_recientes: dispositivosRes.rows,
      ultimas_alertas: alertasRes.rows,
    };
  },
};
