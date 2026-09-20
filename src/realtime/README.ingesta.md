# Realtime — Parte 3: ingesta de mediciones

> Estado: ✅ implementado.
> Depende de: Parte 1 (servidor WS) y Parte 2 (emisores).

## Objetivo

Cuando `POST /api/v1/iot/mediciones` procesa **al menos una** medición, el
dispositivo se marca vivo y se emite el evento realtime correspondiente —
**solo si hay una transición real** de estado.

## Flujo (el COMMIT va primero)

```
POST /iot/mediciones
  → guardar mediciones            (PostgreSQL)
  → actualizar ultima_conexion    (PostgreSQL)   } registrarContacto()
  → estado = 'online'             (PostgreSQL)   }  (ya confirmado)
  → COMMIT
  → emitir dispositivo:online  (solo si offline → online)
```

> ⚠️ No se emiten eventos antes del COMMIT: el `UPDATE`/`INSERT` ocurre dentro
> de `deviceService.registrarContacto`, y la emisión viene inmediatamente
> después de que esa llamada retorna.

## Reglas anti-ruido aplicadas

| Situación | ¿Emite? |
|---|---|
| Dispositivo nuevo / estaba `offline` | `dispositivo:online` |
| Dispositivo ya `online` (caso normal, 100 sensores) | **NO** emite nada de dispositivo |
| Solo cambia `ultima_conexion` | **NO** emite `dispositivo:actualizado` |

Esto evita el escenario de "100 sensores → cientos de eventos redundantes":
la actividad continua se comunica con `medicion:nueva` (segunda entrega) y el
estado solo cambia cuando de verdad cambia.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/modules/devices/device.service.ts` | `registrarContacto()` devuelve `{ anterior, actual }`. |
| `src/modules/iot/iot.service.ts` | Tras el contacto, llama a `emitirDispositivoOnline(anterior, actual)`. |

## Ejemplo

Petición:

```json
POST /api/v1/iot/mediciones
{
  "dispositivo": "ESP32-Q2",
  "mediciones": [{ "canal": "DHT22-01-TEMPERATURA", "valor": 23.4 }]
}
```

Si el dispositivo estaba `offline`, los clientes conectados reciben:

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

Si ya estaba `online`, **no se emite nada de dispositivo** (solo la respuesta
HTTP normal).
