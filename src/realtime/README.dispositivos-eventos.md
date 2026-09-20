# Realtime — Parte 2: emisores de dispositivos

> Estado: ✅ implementado.
> Se apoya en la Parte 1 (servidor WS + contrato de eventos).

## Objetivo

Tener **un único punto de emisión** para los eventos de dispositivo, con las
reglas anti-ruido aplicadas dentro, de modo que ningún controlador, servicio,
repositorio o job llame a `emitirEvento`/`socket.send` directamente.

## Archivo creado

| Archivo | Descripción |
|---|---|
| `src/realtime/dispositivos.eventos.ts` | Emisores centralizados de dispositivos. |

## Funciones

| Función | Emite | Cuándo |
|---|---|---|
| `emitirDispositivoOnline(anterior, actual)` | `dispositivo:online` | Solo si `anterior.estado !== 'online'` y `actual.estado === 'online'`. |
| `emitirDispositivoOffline(anterior, actual, detectadoEn)` | `dispositivo:offline` | Solo si `actual.estado === 'offline'` y `anterior.estado !== 'offline'`. |
| `emitirDispositivoActualizado(anterior, actual, campos)` | `dispositivo:actualizado` | Solo si hay **campos relevantes** cambiados. |

Todas devuelven `boolean` (si emitieron o no), útil para tests.

## Campos considerados "relevantes"

`nombre`, `tipo`, `fabricante`, `modelo`, `identificador`, `protocolo`,
`direccion_ip`, `metadatos`, `estado`.

> **`ultima_conexion` NO está en la lista a propósito.** Cambia en cada
> medición; incluirlo generaría cientos de eventos redundantes. La actividad
> reciente se comunica con `medicion:nueva` (segunda entrega) o con
> `dispositivo:online` cuando realmente hay transición.

## Helper

`calcularCamposCambiados(anterior, actual)` compara por JSON y devuelve los
nombres de los campos que cambiaron. Se usa internamente y también puede
usarse en tests o en el heartbeat para el campo `campos_cambiados`.

## Ejemplos de payloads

`dispositivo:online` (transición offline → online):

```json
{
  "tipo": "dispositivo:online",
  "datos": {
    "dispositivo_id": "uuid",
    "identificador": "ESP32-Q2",
    "estado_anterior": "offline",
    "estado": "online",
    "ultima_conexion": "2026-09-11T16:00:00.000Z"
  },
  "emitido_en": "2026-09-11T16:00:00.010Z"
}
```

`dispositivo:offline` (transición online → offline):

```json
{
  "tipo": "dispositivo:offline",
  "datos": {
    "dispositivo_id": "uuid",
    "identificador": "ESP32-Q2",
    "estado": "offline",
    "ultima_conexion": "2026-09-11T15:55:00.000Z",
    "detectado_en": "2026-09-11T16:00:00.000Z"
  },
  "emitido_en": "2026-09-11T16:00:00.050Z"
}
```

`dispositivo:actualizado` (cambio de RSSI por heartbeat):

```json
{
  "tipo": "dispositivo:actualizado",
  "datos": {
    "dispositivo_id": "uuid",
    "identificador": "ESP32-Q2",
    "estado": "online",
    "ultima_conexion": "2026-09-11T16:00:00.000Z",
    "direccion_ip": "192.168.1.42",
    "metadatos": { "firmware": "1.4.2", "rssi": -70 },
    "campos_cambiados": ["metadatos"]
  },
  "emitido_en": "2026-09-11T16:00:00.020Z"
}
```
