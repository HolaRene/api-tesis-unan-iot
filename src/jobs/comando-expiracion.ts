/**
 * Expiración de comandos de actuador.
 *
 * Job periódico que descarta los comandos encolados que nadie recogió dentro
 * del plazo configurado (`COMANDO_EXPIRACION_MINUTOS`).
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ HACE FALTA
 * ──────────────────────────────────────────────────────────────────────
 * Cuando un usuario pulsa un botón, el comando queda `pendiente` hasta que
 * Node-RED lo recoge y lo entrega al equipo.
 *
 * Si Node-RED está caído, su API Key está revocada o la red se cortó, el
 * comando se queda ahí **indefinidamente**. Y cuando el servicio vuelve, se
 * encuentra la cola llena de órdenes de hace horas y las ejecuta de golpe:
 *
 *     «A las 09:15 pulsé el extractor. A las 11:40 se encendió solo.»
 *
 * Eso es peor que no accionar: en un quirófano, un extractor que arranca sin
 * aviso no es una orden ejecutada, es un incidente.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ NO SE TOCA
 * ──────────────────────────────────────────────────────────────────────
 * Solo se expiran los que siguen en `pendiente`. Los `enviado` ya salieron
 * hacia el equipo y están esperando su confirmación; expirarlos escondería
 * una orden que quizá se ejecutó de verdad.
 *
 * Se arranca desde `server.ts` y se detiene en el apagado controlado.
 */
import { env } from '../config/env.js';
import { comandoActuadorService } from '../modules/comandos-actuador/comando-actuador.service.js';

/** Handle del intervalo activo (o null si no está corriendo/desactivado). */
let temporizador: NodeJS.Timeout | null = null;

/**
 * Ejecuta una pasada de expiración.
 *
 * @returns Cuántos comandos se marcaron como expirados.
 */
export async function ejecutarExpiracionComandos(): Promise<number> {
  const minutos = env.COMANDO_EXPIRACION_MINUTOS;
  if (minutos <= 0) return 0;

  const expirados = await comandoActuadorService.expirarPendientes(minutos);

  if (expirados > 0) {
    console.warn(
      `[comandos] ${expirados} comando(s) expirado(s) sin recoger (más de ${minutos} min pendientes). ` +
        'Revise que Node-RED esté activo y su API Key sea válida.'
    );
  }

  return expirados;
}

/**
 * Arranca el job periódico. Si `COMANDO_EXPIRACION_INTERVALO_SEG` es 0, no se
 * activa (útil en tests o despliegues sin expiración).
 */
export function iniciarExpiracionComandos(): void {
  const intervalo = env.COMANDO_EXPIRACION_INTERVALO_SEG;
  if (intervalo <= 0 || env.COMANDO_EXPIRACION_MINUTOS <= 0) {
    console.log(
      '[comandos] Expiración desactivada (COMANDO_EXPIRACION_INTERVALO_SEG=0 o COMANDO_EXPIRACION_MINUTOS=0)'
    );
    return;
  }
  if (temporizador) return;

  temporizador = setInterval(() => {
    ejecutarExpiracionComandos().catch((error) => {
      console.error(
        '[comandos] Error expirando comandos pendientes:',
        error instanceof Error ? error.message : error
      );
    });
  }, intervalo * 1000);

  // No debe mantener el proceso vivo por sí solo.
  temporizador.unref?.();

  console.log(
    `[comandos] Expiración activa: cada ${intervalo}s descarta pendientes de más de ${env.COMANDO_EXPIRACION_MINUTOS} min`
  );
}

/** Detiene el job (apagado controlado). */
export function detenerExpiracionComandos(): void {
  if (temporizador) {
    clearInterval(temporizador);
    temporizador = null;
  }
}
