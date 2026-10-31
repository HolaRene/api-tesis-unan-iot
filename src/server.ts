import { crearApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './database/pool.js';
import {
  detenerWatchdogDispositivos,
  iniciarWatchdogDispositivos,
} from './jobs/device-watchdog.js';
import {
  detenerExpiracionComandos,
  iniciarExpiracionComandos,
} from './jobs/comando-expiracion.js';
import {
  cerrarServidorRealtime,
  montarServidorRealtime,
} from './realtime/websocket.servidor.js';
import { sembrarPlantillasDesdeJson } from './modules/plantillas-alerta/plantilla-alerta.service.js';

/**
 *  Punto de entrada de la API. Configura el servidor Express y gestiona
 *  el arranque y apagado controlado del mismo, incluyendo el cierre del
 *  pool de conexiones de PostgreSQL.
 */
async function iniciarServidor(): Promise<void> {
  const app = crearApp();
  const puerto = env.PORT;

  const servidor = app.listen(puerto, () => {
    console.log(
      `[api] Servidor iniciado en http://localhost:${puerto} (entorno: ${env.NODE_ENV})`
    );
    // Job de monitorización: marca offline los dispositivos sin contacto.
    iniciarWatchdogDispositivos();
    // Job de seguridad: descarta comandos que nadie recogió a tiempo.
    iniciarExpiracionComandos();

    /*
     * Siembra de normas: copia los JSON de src/plantillas-alerta a la tabla
     * `plantillas_alerta`. Idempotente, así que puede correr en cada
     * arranque. No bloquea el servidor: si fallara, la API sigue sirviendo
     * con las normas que ya hubiera en la base.
     */
    sembrarPlantillasDesdeJson()
      .then((n) =>
        console.log(`[api] Normas sembradas desde JSON: ${n}`)
      )
      .catch((e) =>
        console.error(
          `[api] No se pudieron sembrar las normas: ${e instanceof Error ? e.message : e}`
        )
      );
  });

  // Capa realtime: WebSocket sobre el mismo servidor HTTP.
  montarServidorRealtime(servidor);

  // Apagado controlado ante señales del sistema operativo.
  const apagar = async (senal: string): Promise<void> => {
    console.log(`[api] Recibida señal ${senal}, cerrando servidor...`);
    detenerWatchdogDispositivos();
    detenerExpiracionComandos();
    await cerrarServidorRealtime();
    servidor.close(async () => {
      await closePool();
      console.log('[api] Servidor y pool de conexiones cerrados');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void apagar('SIGINT'));
  process.on('SIGTERM', () => void apagar('SIGTERM'));
}

iniciarServidor().catch((error) => {
  console.error('[api] Error al iniciar el servidor', error);
  process.exit(1);
});
