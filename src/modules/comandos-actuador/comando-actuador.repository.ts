import { query } from '../../database/pool.js';
import type { ComandoActuadorConRelaciones } from './comando-actuador.types.js';

/** Columnas base del comando. */
const CAMPOS_BASE = `
  c.id, c.actuador_id, c.usuario_id, c.clave_api_id, c.comando, c.valor,
  c.estado, c.creado_en, c.enviado_en, c.ejecutado_en, c.respuesta, c.metadatos`;

/** Columnas con relaciones legibles. */
const SELECT_COMANDO = `
  ${CAMPOS_BASE},
  ac.codigo AS actuador_codigo,
  ac.nombre AS actuador_nombre,
  ac.dispositivo_id AS dispositivo_id,
  ac.topico_mqtt AS actuador_topico_mqtt,
  ac.estado_actual AS actuador_estado_actual,
  ac.tipo AS actuador_tipo,
  di.nombre AS dispositivo_nombre,
  di.identificador AS dispositivo_identificador,
  ar.nombre AS area_nombre,
  ca.nombre AS clave_api_nombre
`;

const FROM_COMANDO = `
  FROM comandos_actuador c
  LEFT JOIN actuadores ac ON ac.id = c.actuador_id
  LEFT JOIN dispositivos di ON di.id = ac.dispositivo_id
  LEFT JOIN areas ar         ON ar.id = di.area_id
  LEFT JOIN claves_api ca    ON ca.id = c.clave_api_id
`;

/**
 * Repositorio de comandos de actuadores.
 * Registra trazabilidad de usuario o API Key (ambos opcionales en BD,
 * según origen).
 */
export const comandoActuadorRepository = {
  /** Registra un comando en la tabla. */
  async crear(datos: {
    actuador_id: string;
    usuario_id?: string | null;
    clave_api_id?: string | null;
    comando: string;
    valor?: unknown;
    metadatos?: Record<string, unknown>;
  }): Promise<ComandoActuadorConRelaciones> {
    const insertado = await query<{ id: string }>(
      `INSERT INTO comandos_actuador
         (actuador_id, usuario_id, clave_api_id, comando, valor, metadatos)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        datos.actuador_id,
        datos.usuario_id ?? null,
        datos.clave_api_id ?? null,
        datos.comando,
        datos.valor !== undefined ? JSON.stringify(datos.valor) : null,
        datos.metadatos ? JSON.stringify(datos.metadatos) : JSON.stringify({}),
      ]
    );
    return (await this.buscarPorId(insertado.rows[0].id)) as ComandoActuadorConRelaciones;
  },

  /**
   * Comandos PENDIENTES de entrega, del más antiguo al más nuevo.
   *
   * Lo usan Node-RED y los propios equipos (autenticados con API Key) para
   * recoger las órdenes que la web ha encolado. Se ordena por `creado_en` ASC
   * para respetar el orden en que el usuario los envió: si se pulsó "ON" y
   * luego "OFF", debe llegar primero el ON.
   *
   * @param filtro.identificador  Si se indica, solo se devuelven los comandos
   *   de los actuadores de ESE dispositivo. Es lo que permite a un ESP32
   *   preguntar únicamente por sus propias órdenes en lugar de recibir las de
   *   toda la instalación.
   * @param filtro.actuadorCodigo  Si se indica, solo los de ese actuador.
   */
  async listarPendientes(
    filtro: { identificador?: string; actuadorCodigo?: string } = {},
    limite = 50
  ): Promise<ComandoActuadorConRelaciones[]> {
    const cond: string[] = [`c.estado = 'pendiente'`];
    const valores: unknown[] = [];

    if (filtro.identificador) {
      valores.push(filtro.identificador);
      cond.push(`di.identificador = $${valores.length}`);
    }
    if (filtro.actuadorCodigo) {
      valores.push(filtro.actuadorCodigo);
      cond.push(`ac.codigo = $${valores.length}`);
    }

    valores.push(limite);

    const r = await query<ComandoActuadorConRelaciones>(
      `SELECT ${SELECT_COMANDO} ${FROM_COMANDO}
       WHERE ${cond.join(' AND ')}
       ORDER BY c.creado_en ASC
       LIMIT $${valores.length}`,
      valores
    );
    return r.rows;
  },

  /**
   * Busca un comando por su id (con relaciones).
   *
   * El `SELECT` incluye `ac.topico_mqtt`, que es lo que necesita Node-RED
   * para saber a qué tema publicar.
   */
  async buscarPorId(id: string): Promise<ComandoActuadorConRelaciones | null> {
    const r = await query<ComandoActuadorConRelaciones>(
      `SELECT ${SELECT_COMANDO} ${FROM_COMANDO} WHERE c.id = $1 LIMIT 1`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  /** Lista comandos de un actuador, más recientes primero. */
  async listarPorActuador(
    actuadorId: string,
    limite = 50
  ): Promise<ComandoActuadorConRelaciones[]> {
    const r = await query<ComandoActuadorConRelaciones>(
      `SELECT ${SELECT_COMANDO} ${FROM_COMANDO}
       WHERE c.actuador_id = $1
       ORDER BY c.creado_en DESC LIMIT $2`,
      [actuadorId, limite]
    );
    return r.rows;
  },

  /** Actualiza estado / fechas / respuesta al entregar a un dispositivo. */
  async actualizarProceso(
    id: string,
    datos: Partial<{
      estado: string;
      enviado_en: Date;
      ejecutado_en: Date;
      respuesta: unknown;
    }>
  ): Promise<void> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let i = 1;
    if (datos.estado !== undefined) {
      sets.push(`estado = $${i++}`);
      valores.push(datos.estado);
    }
    if (datos.enviado_en !== undefined) {
      sets.push(`enviado_en = $${i++}`);
      valores.push(datos.enviado_en);
    }
    if (datos.ejecutado_en !== undefined) {
      sets.push(`ejecutado_en = $${i++}`);
      valores.push(datos.ejecutado_en);
    }
    if (datos.respuesta !== undefined) {
      sets.push(`respuesta = $${i++}`);
      valores.push(JSON.stringify(datos.respuesta));
    }
    if (sets.length === 0) return;
    valores.push(id);
    await query(`UPDATE comandos_actuador SET ${sets.join(', ')} WHERE id = $${i}`, valores);
  },
};
