# Realtime — 3.ª entrega: alertas

> Estado: ✅ implementado.
> Completa la 1.ª entrega (dispositivos) y la 2.ª (mediciones/canales).

## Eventos

| Evento | Cuándo |
|---|---|
| `alerta:creada` | Se inserta una alerta nueva (evaluación de reglas o alta manual). |
| `alerta:actualizada` | Cambia la alerta sin resolverse: reconocida, severidad, mensaje… |
| `alerta:resuelta` | La alerta pasa a `resolved`. |

Todos se emiten **después del COMMIT**.

## Reglas anti-ruido

| Situación | ¿Emite? |
|---|---|
| La regla se cumple y **ya había** una alerta activa | **No** (no duplica) |
| La regla deja de cumplirse y **no había** alerta activa | **No** (el `UPDATE` no toca nada) |
| Se resuelve una alerta ya `resolved` | **No** |
| Reconocer una alerta | `alerta:actualizada` (nunca `alerta:resuelta`) |
| Resolver una alerta | `alerta:resuelta` **y solo ese** (no se emite además "actualizada") |

La decisión vive en la función pura `tipoEventoDeAlerta(alerta)`, testeada.

## Dónde se emite

| Punto | Evento |
|---|---|
| `alertService.crear()` (POST /alerts) | `alerta:creada` |
| `alertService.evaluarMedicion()` → `crearDesdeRegla()` | `alerta:creada` |
| `alertService.evaluarMedicion()` → `resolverPorRegla()` | `alerta:resuelta` (por cada una) |
| `alertService.reconocer()` (PATCH /alerts/:id/reconocer) | `alerta:actualizada` |
| `alertService.resolver()` (PATCH /alerts/:id/resolver) | `alerta:resuelta` |
| `alertService.actualizar()` (PATCH /alerts/:id) | el que corresponda al estado nuevo |

## Cambio de soporte: `resolverPorRegla` devuelve las afectadas

Antes hacía un `UPDATE` sin retorno, así que el service no sabía **qué** alertas
resolvió. Ahora usa `RETURNING` y devuelve las filas:

- Si no había activas → array vacío → **no se emite nada** (evita repetir).
- Si había N → se emite `alerta:resuelta` por cada una, tras el COMMIT.

## Endpoint nuevo

`PATCH /api/v1/alerts/:id/resolver` (rol `usuario`/`admin`): pasa la alerta a
`resolved`, sella `finalizada_en` y emite `alerta:resuelta`.

> El frontend, que antes hacía `PATCH /alerts/:id { estado: 'resolved' }`, ahora
> usa este endpoint dedicado (`resolverAlerta` en el servicio).

## Archivos creados

| Archivo | Descripción |
|---|---|
| `api/src/realtime/alertas.eventos.ts` | Emisores + `tipoEventoDeAlerta()` (pura). |
| `api/src/realtime/alertas.eventos.test.ts` | Tests de la regla anti-duplicación. |
| `frontend/src/hooks/use-eventos-alertas.ts` | Aplica los eventos a la caché. |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `api/src/modules/alerts/alert.repository.ts` | `resolverPorRegla()` devuelve las alertas resueltas. |
| `api/src/modules/alerts/alert.service.ts` | Emite en crear / actualizar / reconocer / resolver / evaluarMedicion. |
| `api/src/modules/alerts/alert.controller.ts` | Método `resolver`. |
| `api/src/modules/alerts/alert.routes.ts` | Ruta `PATCH /:id/resolver`. |
| `frontend/src/servicios/alertas.servicio.ts` | `reconocerAlerta`/`resolverAlerta` usan los endpoints dedicados. |
| `frontend/src/hooks/useAlertas.ts` | Polling 30 s → **90 s**. |
| `frontend/src/components/alertas/gestion-alertas.tsx` | Usa `useEventosAlertas()`. |

## Payload

```json
{
  "tipo": "alerta:creada",
  "datos": {
    "id": "uuid",
    "regla_id": "uuid",
    "canal_id": "uuid",
    "sensor_id": null,
    "medicion_id": 101,
    "tipo": "regla",
    "severidad": "critical",
    "mensaje": "Regla 'Temperatura alta' cumplida",
    "estado": "active",
    "iniciada_en": "2026-09-12T02:00:00.000Z",
    "reconocida_en": null,
    "finalizada_en": null,
    "metadatos": {}
  },
  "emitido_en": "2026-09-12T02:00:00.010Z"
}
```

## Frontend

```
REST   GET /alerts        → carga inicial
WS     alerta:creada      → inserta al inicio de ["alertas"]
WS     alerta:actualizada → reemplaza la alerta en la caché
WS     alerta:resuelta    → reemplaza la alerta (estado resolved)
```

- Todo con `setQueryData` (sin refetch).
- Al reconectar se invalida una vez `["alertas"]`.
- Polling de respaldo: **90 s**.
