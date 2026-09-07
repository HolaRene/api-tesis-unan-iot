# Refactorización a Modelo Multivariable — Etapas

Este documento describe **las etapas por las que va pasando** la refactorización de la
plataforma hacia un modelo de sensores con **canales** (vigilar varias magnitudes por
sensor físico) + **reglas de alerta**.

---

## 1. Objetivo de jerarquía final

```
ÁREA
  ↓ 1:N
DISPOSITIVO            (ESP32, PLC, gateway…)
  ↓ 1:N
SENSOR FÍSICO          (BME280, DHT, medidor…)
  ↓ 1:N
CANAL                  (magnitud concreta: TEMP-Q2, HUM-Q2)
  ├ M:N TIPO_VARIABLE  (significado: Temperatura, Humedad — con tipo_dato)
  ↓ 1:N
MEDICIONES
  ↓ evalúa
REGLA_ALERTA
  ↓ genera
ALERTA
```

**Concepto clave:** un sensor físico entrega **una o varias magnitudes**; cada una es un
**canal**. Las mediciones, reglas y alertas **siempre pertenecen a un canal**, nunca a
un "sensor todo".

---

## 2. Estado encontrado antes del refactor (Fase 0)

### Backend (estado actual)
- Tablas existentes: `usuarios`, `areas`, `dispositivos`, `tipos_variable`, `sensores`,
  `mediciones`, `umbrales`, `alertas`, `camaras`, `integraciones`, `claves_api`,
  `actuadores`, `comandos_actuador`, `reglas_??` (no existe reglas_alerta aún).
- **Hoy**: `sensores` guarda `tipo_variable_id + unidad + rango_min + rango_max` y
  `mediciones.sensor_id` apunta directo al sensor (1 magnitud por sensor).
- `umbrales` (tabla vieja de "regla") es de sensor y está casi sin lógica.
- Endpoints actuales: `/sensors`, `/measurements`, `/thresholds`, `/alerts`, `/variable-types`,
  integración `POST /iot/mediciones` acepta `sensor`.

### Frontend (estado actual)
- Existe jerarquía simplificada sensor → tipo variable (sin "canal").
- Páginas: `/sensores`, `/sensores/[id]`, `/mediciones`, `/alertas`, `/areas`,
  `/dispositivos`.
- Historial global en `/mediciones`; gráficas según `tipo_dato`.

### Decisión de migración (importante)
Como la BD ha sufrido reinicios y no se puede inferir con seguridad un agrupamiento
multi-canal de datos previos, se realiza una **migración por defecto unívoca**:

> **Cada sensor heredado pasa a un canal** (1 sensor → 1 canal, provisional). Si más
> adelante se registra un sensor físico con varios canales reales (BME280), se crea
> un sensor físico + sus N canales desde cero.

Esto **mantiene compatibilidad**: `sensor`/`canal` se normaliza siempre a **canal**.

---

## 3. Fases de la refactorización

### 3.1. FASE 0 — Análisis y este README (hecha)
- Revisión backend/front.
- Documentar plan y estrategia de compatibilidad.
- (Puede añadir aquí capturas de endpoints si es de ayuda.)

### 3.2. FASE 1 — Backend `canales`
1. Migración:
   - `CREATE TABLE IF NOT EXISTS canales (...)`
   - `ALTER TABLE mediciones` : añadir `canal_id` nullable → poblar (1 sensor→1 canal) → poner NOT NULL.
   - Renombrar conceptualmente `umbrales` → **nueva** `reglas_alerta`; coexistir sin borrar umbrales.
2. Datos legado:
   - Crear canal por sensor (copiando tipo_variable, unidad, rango, "precision").
   - Vincular mediciones existentes del sensor al canal.
3. Endpoints canales:
   - `GET/POST /canales`, `GET/PATCH /canales/:id`, `GET /canales/:id/mediciones`.
4. Compatibilidad de ingesta:
   - `POST /iot/mediciones` acepta `sensor` y `canal`; normaliza a canal.

### 3.3. FASE 2 — Backend `reglas_alerta` y alertas
1. Migración `reglas_alerta` (con `canal_id`, `operador`, referencias, severidad…).
2. CRUD de reglas con validación Zod según `tipo_dato`:
   - numeric → `<, <=, >, >=, =, entre, fuera_de_rango`
   - boolean → `es_true, es_false`
   - text → `igual_a, diferente_de, contiene`
   - json → no reglas genéricas por ahora.
3. Evaluación post-medición:
   - Obtener reglas activas del canal.
   - Crear/ no duplicar alerta si cond cumple (una alerta activa por regla).
   - Resolver alerta activa cuando deja de cumplirse (`finalizada_en`).
   - Campo `retardo_segundos` se crea preparado; por ahora sin activarlo (documentado).
4. Endpoints reglas: `GET/POST/PATCH/DELETE /reglas-alerta`.
5. Alertas: refieren `regla_id + canal_id + medicion_id`; endpoint reconocer `PATCH /alertas/:id/reconocer`.
6. Dashboard/global mediciones se adaptan a canal (via compat).

### 3.4. FASE 3 — Frontend adaptado
- Jerarquía visual: dispositivo → sensor físico → **canales**.
- Página `/sensores/[id]` lista canales del sensor.
- Página **`/canales/[id]`** (nueva): canal + historial + gráficas (por tipo_dato) + reglas + alertas.
- Formularios de regla **dinámicos** según `tipo_dato`.
- Página `/alertas` enriquecida y detalle `/alertas/[id]`, reconocimiento.
- Dashboard con componentes genéricos (canales).

### 3.5. FASE 4 — Verificación
- `tsc`, `build` backend, `build` frontend.
- Probar: crear canal, crear regla, ingesta, alerta, resolución.

---

## 4. Estrategia de compatibilidad

1. Nunca romper la ruta `/sensors` ni `/measurements` básicos; en su interior responden
   pasando por canal/adaptador.
2. la ingesta acepta `{sensor}` y `{canal}` y normaliza a canal.
3. La tabla vieja `umbrales` se deja sin borrar (deprecada), la nueva es `reglas_alerta`.
4. `alertas` viejas (sin `canal_id`) se migran con el canal del sensor cuando se pueda;
   si no, se marcan e ignoran en nuevos flujos.

---

## 5. Cómo se genera una alerta (flujo objetivo)

1. llega `POST /iot/mediciones` con canal (o sensor) al dispositivo correcto.
2. Backend guarda medición según `tipo_variable.tipo_dato` → columna correspondiente.
3. Busca **reglas activas del canal**, evalúa operador vs valor.
4. ¿Cumple?
   - Sí → si no hay alerta activa para esa regla → crea alerta (`activa`).
   - Sí → si ya hay activa → no duplica.
   - No → si había alerta activa → la marca `resuelta` con `finalizada_en`.
5. El usuario puede **reconocer** la alerta (`PATCH reconocer`) manteniéndola hasta resolverse.

---

## 6. Entregables en cada fase (checklist)

- [ ] FASE 0: README (este) y análisis.
- [ ] FASE 1: migración canales + adaptar mediciones/ingesta + endpoints canales.
- [ ] FASE 2: migración reglas_alerta + validación + generación/resolución de alertas + endpoints.
- [ ] FASE 3: frontend jerarquía y canales/reglas/alertas.
- [ ] FASE 4: typecheck/builds y pruebas.
