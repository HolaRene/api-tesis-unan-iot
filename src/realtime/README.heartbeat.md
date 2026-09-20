# Realtime — Parte 4: heartbeat

> Estado: ✅ implementado.

## Objetivo

Que `POST /api/v1/iot/dispositivos/:identificador/estado` notifique por
WebSocket los cambios relevantes reportados por el equipo, **después** de
confirmar PostgreSQL.

## Flujo

```
POST /iot/dispositivos/:identificador/estado
  1. validar API Key              (middleware autenticarApiKey)
  2. validar permiso              (estado:actualizar)
  3. actualizar PostgreSQL        (estado, ultima_conexion, IP)
  4. fusionar metadatos           (no reemplaza: hace merge)
  5. COMMIT
  6. emitir WebSocket
```

## Eventos emitidos

| Condición | Evento |
|---|---|
| Cambió IP, metadatos (firmware/RSSI/uptime), estado u otro campo relevante | `dispositivo:actualizado` |
| Además, si hubo transición **a** `online` (p. ej. `offline` → `online`) | `dispositivo:online` |

Si no cambió nada relevante (mismo estado, mismos metadatos), **no se emite
nada**: evita duplicados cuando un equipo manda el mismo heartbeat cada minuto.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/modules/iot/iot.service.ts` | `actualizarEstadoDispositivo()` emite actualizado + online tras el COMMIT. |
| `src/modules/iot/iot.controller.ts` | Responde el dispositivo actual (el servicio ahora devuelve `{anterior, actual}`). |

## Ejemplos

Heartbeat que cambia el RSSI (`-58` → `-70`) estando online:

```json
{
  "tipo": "dispositivo:actualizado",
  "datos": {
    "dispositivo_id": "uuid",
    "identificador": "ESP32-Q2",
    "estado": "online",
    "ultima_conexion": "2026-09-11T16:00:00.000Z",
    "direccion_ip": "192.168.1.42",
    "metadatos": { "firmware": "1.4.2", "rssi": -70, "uptime_s": 87000 },
    "campos_cambiados": ["metadatos"]
  },
  "emitido_en": "2026-09-11T16:00:00.020Z"
}
```

Heartbeat de un equipo que estaba `offline` y reporta `online`:

```json
// 1) dispositivo:actualizado  (estado y ultima_conexion cambiaron)
// 2) dispositivo:online
{
  "tipo": "dispositivo:online",
  "datos": {
    "dispositivo_id": "uuid",
    "identificador": "ESP32-Q2",
    "estado_anterior": "offline",
    "estado": "online",
    "ultima_conexion": "2026-09-11T16:00:00.000Z"
  },
  "emitido_en": "2026-09-11T16:00:00.030Z"
}
```

## Permisos

La API Key debe tener `estado:actualizar`. La validación de la clave y del
permiso ya existía (`autenticarApiKey` + `verificarPermisosApi`); no se ha
modificado.
