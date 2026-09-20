/**
 * Watchdog de dispositivos.
 *
 * Job periódico que marca como `offline` los dispositivos que llevan más de
 * `DEVICE_OFFLINE_MINUTOS` sin registrar contacto (`ultima_conexion`), para que
 * el estado mostrado en la web refleje la realidad (un PLC/ESP32 apagado o sin
 * red deja de estar `online`).
 *
 * Se arranca desde `server.ts` y se detiene en el apagado controlado.
 */
import { env } from '../config/env.js';
import { deviceService } from '../modules/devices/device.service.js';
import { emitirDispositivoOffline } from '../realtime/dispositivos.eventos.js';

/** Handle del intervalo activo (o null si no está corriendo/desactivado). */
let temporizador: NodeJS.Timeout | null = null;

/**
 * Ejecuta una pasada del watchdog.
 *
 * 1. Busca los dispositivos cuyo timeout venció.
 * 2. Los marca `offline` en PostgreSQL (el UPDATE ya confirma el cambio).
 * 3. SOLO después emite `dispositivo:offline` (una vez por transición).
 *
 * El `UPDATE` excluye a los que ya estaban `offline`, así que reejecutar el
 * watchdog no vuelve a emitir nada.
 *
 * Devuelve cuántos dispositivos se marcaron offline.
 */
export async function ejecutarWatchdogDispositivos(): Promise<number> {
  const minutos = env.DEVICE_OFFLINE_MINUTOS;
  const afectados = await deviceService.marcarOfflineSinContacto(minutos);

  const detectadoEn = new Date();
  for (const { anterior, actual } of afectados) {
    // Emisión posterior al COMMIT: `marcarOfflineSinContacto` ya cerró la
    // transacción. El emisor solo dispara en la transición real (online→offline).
    emitirDispositivoOffline(anterior, actual, detectadoEn);
  }

  if (afectados.length > 0) {
    console.log(
      `[watchdog] ${afectados.length} dispositivo(s) marcados offline (sin contacto > ${minutos} min)`
    );
  }
  return afectados.length;
}

/**
 * Arranca el job periódico. Si `DEVICE_WATCHDOG_INTERVALO_SEG` es 0, no se
 * activa (útil en tests o despliegues sin watchdog).
 */
export function iniciarWatchdogDispositivos(): void {
  const intervalo = env.DEVICE_WATCHDOG_INTERVALO_SEG;
  if (intervalo <= 0) {
    console.log('[watchdog] Desactivado (DEVICE_WATCHDOG_INTERVALO_SEG=0)');
    return;
  }
  if (temporizador) return;

  temporizador = setInterval(() => {
    ejecutarWatchdogDispositivos().catch((error) => {
      console.error(
        '[watchdog] Error revisando dispositivos offline:',
        error instanceof Error ? error.message : error
      );
    });
  }, intervalo * 1000);

  // No debe mantener el proceso vivo por sí solo.
  temporizador.unref?.();

  console.log(
    `[watchdog] Activo: cada ${intervalo}s marca offline tras ${env.DEVICE_OFFLINE_MINUTOS} min sin contacto`
  );
}

/** Detiene el job (apagado controlado). */
export function detenerWatchdogDispositivos(): void {
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
}
