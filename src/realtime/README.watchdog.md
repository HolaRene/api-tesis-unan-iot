# Realtime — Parte 5: watchdog

> Estado: ✅ implementado.
> Archivo: `src/jobs/device-watchdog.ts`

## Objetivo

Detectar dispositivos caídos y emitir `dispositivo:offline` **una sola vez**
por transición, después de confirmar la base de datos.

## Flujo

```
cada DEVICE_WATCHDOG_INTERVALO_SEG
  1. buscar dispositivos cuyo timeout venció   (SELECT ... ultima_conexion < NOW() - X)
  2. UPDATE estado = 'offline'                 (PostgreSQL)
  3. COMMIT
  4. emitir dispositivo:offline                (solo para los realmente cambiados)
```

## Cómo se evita repetir el evento

Dos capas:

1. **En SQL**: el `UPDATE` filtra `WHERE estado <> 'offline'`. Un dispositivo
   que ya está `offline` **no se toca**, así que no entra en el resultado.
2. **En el emisor**: `emitirDispositivoOffline()` exige la transición
   `anterior.estado !== 'offline'` → `actual.estado === 'offline'`. Aunque algo
   llegara ya offline, no emitiría.

Resultado: ejecutar el watchdog N veces sólo genera **un** evento por caída.

Para poder informar `estado_anterior`, el `UPDATE` usa un CTE que captura el
estado previo y lo devuelve junto al nuevo, sin una segunda consulta.

## Payload

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

## Configuración

| Variable | Defecto | Descripción |
|---|---|---|
| `DEVICE_OFFLINE_MINUTOS` | `5` | Minutos sin contacto para considerar caído. |
| `DEVICE_WATCHDOG_INTERVALO_SEG` | `60` | Cada cuánto corre el job. `0` lo desactiva. |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/modules/devices/device.service.ts` | `marcarOfflineSinContacto()` devuelve `{anterior, actual}[]` (CTE) en vez de un contador. |
| `src/jobs/device-watchdog.ts` | Emite `dispositivo:offline` por cada transición, tras el UPDATE. |
