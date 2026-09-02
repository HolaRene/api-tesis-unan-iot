import { crearApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './database/pool.js';

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
  });

  // Apagado controlado ante señales del sistema operativo.
  const apagar = async (senal: string): Promise<void> => {
    console.log(`[api] Recibida señal ${senal}, cerrando servidor...`);
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
