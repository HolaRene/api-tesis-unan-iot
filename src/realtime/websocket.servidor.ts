/**
 * Servidor WebSocket (realtime).
 *
 * Se monta SOBRE el mismo servidor HTTP de Express (mismo puerto), en la ruta
 * `WS_PATH` (`/api/v1/realtime`). Así no hay puertos extra ni CORS aparte.
 *
 * Autenticación: el cliente debe enviar el JWT al conectar, de una de estas
 * dos formas:
 *   - Query string:  ws://host/api/v1/realtime?token=<JWT>
 *   - Primer mensaje: { "tipo": "autenticar", "token": "<JWT>" }
 *
 * Si el token no es válido, la conexión se cierra con código 4401.
 *
 * Este módulo NO emite eventos: solo gestiona conexiones. Para emitir se usan
 * los emisores centralizados de `src/realtime/*.eventos.ts`.
 */
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verificarToken } from '../utils/jwt.js';
import type { EventoTiempoReal, MensajeCliente } from './eventos.js';

/** Ruta del WebSocket (misma base que la API REST). */
export const WS_PATH = '/api/v1/realtime';

/** Cliente conectado con su contexto de autenticación. */
interface ClienteRealtime {
  socket: WebSocket;
  usuarioId: string;
  rol: string;
  conectadoEn: number;
  vivo: boolean;
}

const clientes = new Set<ClienteRealtime>();
let wss: WebSocketServer | null = null;

/** Extrae el token del query string de la URL de conexión. */
function tokenDesdeUrl(req: IncomingMessage): string | null {
  const url = req.url ?? '';
  const indice = url.indexOf('?');
  if (indice === -1) return null;
  const params = new URLSearchParams(url.slice(indice + 1));
  return params.get('token');
}

/** Valida el token y devuelve el usuario, o null si no es válido. */
function autenticarToken(token: string | null | undefined): {
  usuarioId: string;
  rol: string;
} | null {
  if (!token) return null;
  try {
    const payload = verificarToken(token);
    return { usuarioId: payload.id, rol: payload.rol };
  } catch {
    return null;
  }
}

/** Registra un cliente autenticado y configura sus handlers. */
function registrarCliente(socket: WebSocket, usuarioId: string, rol: string): void {
  const cliente: ClienteRealtime = {
    socket,
    usuarioId,
    rol,
    conectadoEn: Date.now(),
    vivo: true,
  };
  clientes.add(cliente);

  // Acuse de conexión (no es un evento de dominio).
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({ tipo: 'conectado', emitido_en: new Date().toISOString() })
    );
  }

  socket.on('pong', () => {
    cliente.vivo = true;
  });

  socket.on('message', (crudo) => {
    try {
      const mensaje = JSON.parse(crudo.toString()) as MensajeCliente;
      if (mensaje.tipo === 'ping') {
        socket.send(JSON.stringify({ tipo: 'pong', emitido_en: new Date().toISOString() }));
      }
      // `suscribir` queda reservado para segmentación por temas (futuro).
    } catch {
      // Mensaje no JSON: se ignora.
    }
  });

  socket.on('close', () => {
    clientes.delete(cliente);
  });

  socket.on('error', () => {
    clientes.delete(cliente);
  });
}

/**
 * Emite un evento a TODOS los clientes conectados.
 *
 * Debe llamarse SIEMPRE después de que PostgreSQL haya confirmado el cambio
 * (COMMIT). Devuelve cuántos clientes recibieron el evento.
 */
export function emitirEvento<T>(evento: EventoTiempoReal<T>): number {
  if (!wss) return 0;
  const mensaje = JSON.stringify(evento);
  let enviados = 0;
  for (const cliente of clientes) {
    if (cliente.socket.readyState === WebSocket.OPEN) {
      cliente.socket.send(mensaje);
      enviados += 1;
    }
  }
  return enviados;
}

/** Número de clientes conectados (para diagnóstico/health). */
export function clientesConectados(): number {
  return clientes.size;
}

/**
 * Monta el servidor WebSocket sobre el servidor HTTP de Express.
 * Debe llamarse una sola vez, desde `server.ts`.
 */
export function montarServidorRealtime(servidor: HttpServer): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ server: servidor, path: WS_PATH });

  wss.on('connection', (socket, req) => {
    const tokenUrl = tokenDesdeUrl(req);
    const auth = autenticarToken(tokenUrl);

    if (auth) {
      registrarCliente(socket, auth.usuarioId, auth.rol);
      return;
    }

    // Sin token en la URL: se espera `{ tipo: 'autenticar', token }` como
    // primer mensaje, con un tiempo límite para autenticarse.
    const temporizador = setTimeout(() => {
      socket.close(4401, 'No autenticado');
    }, 5000);

    const alPrimerMensaje = (crudo: Buffer) => {
      try {
        const mensaje = JSON.parse(crudo.toString()) as { token?: string };
        const authMensaje = autenticarToken(mensaje.token);
        if (!authMensaje) {
          socket.close(4401, 'Token inválido');
          return;
        }
        clearTimeout(temporizador);
        socket.off('message', alPrimerMensaje);
        registrarCliente(socket, authMensaje.usuarioId, authMensaje.rol);
      } catch {
        socket.close(4401, 'Token inválido');
      }
    };

    socket.once('message', alPrimerMensaje);

    socket.on('close', () => clearTimeout(temporizador));
  });

  // Latido: cierra conexiones muertas (evita clientes zombis).
  const latido = setInterval(() => {
    for (const cliente of clientes) {
      if (!cliente.vivo) {
        cliente.socket.terminate();
        clientes.delete(cliente);
        continue;
      }
      cliente.vivo = false;
      cliente.socket.ping();
    }
  }, 30_000);
  latido.unref?.();

  wss.on('close', () => clearInterval(latido));

  console.log(`[realtime] WebSocket escuchando en ${WS_PATH}`);
  return wss;
}

/** Cierra el servidor WebSocket (apagado controlado). */
export async function cerrarServidorRealtime(): Promise<void> {
  if (!wss) return;
  const actual = wss;
  wss = null;
  for (const cliente of clientes) cliente.socket.close(1001, 'Servidor cerrando');
  clientes.clear();
  await new Promise<void>((resolve) => actual.close(() => resolve()));
}
