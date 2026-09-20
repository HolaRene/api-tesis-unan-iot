# Realtime — 2.ª entrega: mediciones y canales

> Estado: ✅ implementado.
> Completa la Parte 1–6 (que solo cubrían dispositivos).

## Qué añade

| Evento | Cuándo |
|---|---|
| `medicion:nueva` | Al guardar un lote de mediciones (ingesta IoT). **Uno por lote**. |
| `canal:actualizado` | Tras guardar mediciones. **Uno por canal afectado**, no por medición. |

Ambos se emiten **después del COMMIT** de cada `INSERT`.

## Bug corregido de paso: no se veían las mediciones

La consulta global de mediciones hacía:

```sql
FROM mediciones m
JOIN sensores s ON s.id = m.sensor_id   -- INNER JOIN ❌
```

Pero el modelo multivariable guarda las mediciones con **`canal_id`** y
`sensor_id = NULL` (la migración `0009` hizo `DROP NOT NULL`). El `JOIN` interno
descartaba **todas** esas filas → `/mediciones` salía vacío aunque en PostgreSQL
hubiera datos.

**Corrección** en `measurement.repository.ts`:

- `LEFT JOIN canales c ON c.id = m.canal_id`
- sensor efectivo: `COALESCE(m.sensor_id, c.sensor_id)`
- tipo de variable: `COALESCE(c.tipo_variable_id, s.tipo_variable_id)`
- nuevo filtro `canal_id`
- `listarHistorialSensor` ahora incluye las mediciones hechas por sus canales

## Archivos creados

| Archivo | Descripción |
|---|---|
| `api/src/realtime/mediciones.eventos.ts` | Emisores `medicion:nueva` y `canal:actualizado` + `agruparPorCanal()`. |
| `api/src/realtime/mediciones.eventos.test.ts` | Tests del agrupamiento (anti-ráfaga). |
| `frontend/src/hooks/use-eventos-mediciones.ts` | Aplica los eventos a la caché con `setQueryData`. |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `api/src/modules/measurements/measurement.repository.ts` | LEFT JOIN + sensor/tipo desde el canal; filtro `canal_id`. |
| `api/src/modules/measurements/measurement.types.ts` | `canal_id` en `FiltrarMediciones`. |
| `api/src/modules/measurements/measurement.schema.ts` | `canal_id` en el query schema. |
| `api/src/modules/measurements/measurement.controller.ts` | Pasa `canal_id`. |
| `api/src/modules/iot/iot.service.ts` | Recoge las mediciones guardadas y emite ambos eventos tras el COMMIT. |
| `frontend/src/hooks/useMediciones.ts` | Polling 15 s → **90 s** (`POLLING_RESPALDO_MS`). |
| `frontend/src/components/mediciones/gestion-mediciones.tsx` | Usa `useEventosMediciones()`. |

## Anti-ráfaga

| Situación | ¿Emite? |
|---|---|
| Lote con 50 mediciones de 2 canales | **1** `medicion:nueva` + **2** `canal:actualizado` |
| Lote de 3 mediciones del mismo canal | **1** `medicion:nueva` + **1** `canal:actualizado` |
| Lote vacío (todas fallidas) | **Nada** |
| `medicion:nueva` repetida (mismo id) | El frontend **no duplica** |

## Payloads

`medicion:nueva` (uno por lote):

```json
{
  "tipo": "medicion:nueva",
  "datos": {
    "dispositivo": "ESP32-MULTI",
    "total": 2,
    "mediciones": [
      { "id": 101, "canal_id": "uuid", "canal_codigo": "DHT22-01-TEMPERATURA",
        "sensor_id": "uuid", "valor_numerico": 25.2, "valor_texto": null,
        "valor_booleano": null, "valor_json": null, "calidad": "good",
        "registrado_en": "2026-09-11T19:00:00.000Z" }
    ]
  },
  "emitido_en": "2026-09-11T19:00:00.010Z"
}
```

`canal:actualizado` (uno por canal):

```json
{
  "tipo": "canal:actualizado",
  "datos": {
    "canal_id": "uuid",
    "canal_codigo": "DHT22-01-TEMPERATURA",
    "sensor_id": "uuid",
    "ultimo_valor_numerico": 25.2,
    "ultimo_valor_texto": null,
    "ultimo_valor_booleano": null,
    "calidad": "good",
    "registrado_en": "2026-09-11T19:00:00.000Z"
  },
  "emitido_en": "2026-09-11T19:00:00.012Z"
}
```

## Frontend

```
REST   GET /measurements        → carga inicial
WS     medicion:nueva           → inserta al inicio (sin duplicar por id)
WS     canal:actualizado        → invalida ["canales"]
```

- Se usa `setQueriesData({ queryKey: ["mediciones"] })`, que aplica a **todas**
  las variantes con filtros (`["mediciones", filtros]`).
- `canal:actualizado` invalida `["canales"]` (la grilla y el detalle del canal),
  que es una vista ligera.
- Polling de respaldo: **90 s**.
