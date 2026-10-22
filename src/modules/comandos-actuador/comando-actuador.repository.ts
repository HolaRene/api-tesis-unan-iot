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
  /*
   * El protocolo y su direccionamiento viajan con el comando: sin ellos, el
   * equipo receptor solo recibe el CÓDIGO del actuador y no sabe DÓNDE
   * accionar. Un PLC no entiende «LED-1»; entiende «coil 100 a 1».
   */
  ac.protocolo AS actuador_protocolo,
  ac.configuracion AS actuador_configuracion,
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
      /** Cuándo Node-RED recogió el comando de la cola. */
      recogido_en: Date;
      /** Cuándo se escribió en el PLC. */
      enviado_en: Date;
      /** Cuándo la lectura de vuelta confirmó el estado pedido. */
      confirmado_en: Date;
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
    if (datos.recogido_en !== undefined) {
      sets.push(`recogido_en = $${i++}`);
      valores.push(datos.recogido_en);
    }
    if (datos.enviado_en !== undefined) {
      sets.push(`enviado_en = $${i++}`);
      valores.push(datos.enviado_en);
    }
    if (datos.confirmado_en !== undefined) {
      sets.push(`confirmado_en = $${i++}`);
      valores.push(datos.confirmado_en);
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

  /**
   * Marca como `expirado` los comandos que llevan demasiado tiempo pendientes.
   *
   * Condiciones para expirar:
   *   - estado `pendiente`: nadie lo ha recogido todavía.
   *   - `creado_en` anterior al corte.
   *
   * NO se tocan los que están en `enviado`: esos ya salieron hacia el equipo
   * y esperan confirmación; expirarlos ocultaría una orden quizá ejecutada.
   *
   * Se deja constancia en `respuesta` del motivo, para que al revisar el
   * historial se entienda por qué no se ejecutó.
   *
   * Devuelve cuántos comandos se expiraron (0 si ninguno).
   */
  async expirarPendientes(minutos: number): Promise<number> {
    const r = await query(
      `UPDATE comandos_actuador
          SET estado = 'expirado',
              respuesta = COALESCE(respuesta, '{}'::jsonb) ||
                          jsonb_build_object(
                            'motivo', 'expirado',
                            'detalle', 'Nadie recogió el comando dentro del plazo configurado',
                            'minutos', $1::int
                          ),
              ejecutado_en = NOW()
        WHERE estado = 'pendiente'
          AND creado_en < NOW() - ($1::int * INTERVAL '1 minute')`,
      [minutos]
    );
    return r.rowCount ?? 0;
  },

  /**
   * Configuración de simulación de los actuadores de un dispositivo.
   *
   * Node-RED la consulta al arrancar (y cada cierto tiempo) para saber
   * cuánto debe tardar cada actuador en reflejar la orden. Así el parámetro
   * vive en UN solo sitio —la configuración del actuador— y no repartido en
   * nodos de Node-RED.
   *
   * Se lee de `actuadores.configuracion`, que es JSONB y ya existe:
   *
   *   { "latencia_s": 6, "timeout_s": 15 }
   *
   * Valores por defecto si no están definidos:
   *   latencia_s = 0   (sin retardo: el equipo responde al instante)
   *   timeout_s  = 3 * latencia + 10  (margen generoso sobre el retardo)
   */
  async configuracionSimulacion(identificador?: string): Promise<
    {
      actuador_codigo: string;
      protocolo: string;
      latencia_s: number;
      timeout_s: number;
    }[]
  > {
    const cond = identificador ? 'AND d.identificador = $1' : '';
    const valores = identificador ? [identificador] : [];

    const r = await query<{
      actuador_codigo: string;
      protocolo: string;
      configuracion: Record<string, unknown> | null;
    }>(
      `SELECT a.codigo AS actuador_codigo,
              a.protocolo,
              a.configuracion
         FROM actuadores a
         JOIN dispositivos d ON d.id = a.dispositivo_id
        WHERE a.activo = TRUE ${cond}
        ORDER BY a.codigo`,
      valores
    );

    return r.rows.map((fila) => {
      const latencia = Number(fila.configuracion?.latencia_s ?? 0) || 0;
      const timeout =
        Number(fila.configuracion?.timeout_s ?? 0) || latencia * 3 + 10;
      return {
        actuador_codigo: fila.actuador_codigo,
        protocolo: fila.protocolo,
        latencia_s: latencia,
        timeout_s: timeout,
      };
    });
  },
};
