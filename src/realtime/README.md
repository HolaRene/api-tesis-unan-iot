# Realtime — Parte 1: infraestructura WebSocket

> Estado: ✅ implementado y verificado (`pnpm check`).
> Entrega por partes. Esta parte **no emite eventos de dominio todavía**: solo
> crea el servidor y el contrato de eventos.

## Por qué

El proyecto **no tenía** capa realtime (no existía `src/realtime/`, ni `ws`/
`socket.io`, ni funciones `emitir*`). Esta parte la crea desde cero.

## Regla fundamental

**PostgreSQL sigue siendo la fuente de verdad.** Nunca se emite un evento antes
de confirmar el `INSERT/UPDATE` correspondiente:

```
cambio → PostgreSQL → COMMIT → WebSocket → frontend
```

## Archivos creados

| Archivo | Descripción |
|---|---|
| `src/realtime/eventos.ts` | Tipos de eventos y payloads (contrato backend↔frontend). |
| `src/realtime/websocket.servidor.ts` | Servidor `ws` montado sobre el HTTP de Express. |
| `src/utils/jwt.ts` | `verificarToken()` compartido (HTTP y WS). |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/server.ts` | Monta el WS y lo cierra en el apagado controlado. |
| `src/middlewares/auth.middleware.ts` | Reutiliza `verificarToken` en vez de duplicar `jwt.verify`. |
| `package.json` | Añade `ws` (+ `@types/ws`). |

## Cómo se conecta el cliente

Mismo puerto que la API, ruta **`/api/v1/realtime`**:

```
ws://localhost:4000/api/v1/realtime?token=<JWT>
```

Alternativa (token en el primer mensaje):

```json
{ "tipo": "autenticar", "token": "<JWT>" }
```

Si el token falta o es inválido → cierre con código **4401**.
Al conectar bien, el servidor responde con un acuse (no es evento de dominio):

```json
{ "tipo": "conectado", "emitido_en": "2026-09-11T16:00:00.000Z" }
```

## Contrato de eventos

```ts
interface EventoTiempoReal<T> {
  tipo: TipoEventoTiempoReal;
  datos: T;
  emitido_en: string; // ISO 8601, lo pone el servidor
}
```

Tipos soportados (los de dispositivos se implementan en esta entrega; el resto
queda declarado para la segunda entrega):

- `dispositivo:actualizado`, `dispositivo:online`, `dispositivo:offline` ✅
- `medicion:nueva`, `canal:actualizado` ⏳
- `alerta:creada`, `alerta:actualizada`, `alerta:resuelta` ⏳

## API del módulo

| Función | Uso |
|---|---|
| `montarServidorRealtime(servidorHttp)` | Se llama una vez desde `server.ts`. |
| `emitirEvento(evento)` | **Único** punto de emisión. Devuelve nº de clientes. |
| `clientesConectados()` | Diagnóstico/health. |
| `cerrarServidorRealtime()` | Apagado controlado. |

> ⚠️ **No usar `socket.send` directamente** desde controladores, servicios,
> repositorios ni el watchdog. Siempre a través de los emisores de
> `src/realtime/*.eventos.ts`.

## Latido (keepalive)

Cada 30 s el servidor hace `ping` a los clientes y termina los que no
respondieron con `pong`, para no acumular conexiones zombis.
