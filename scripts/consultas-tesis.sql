-- =============================================================
-- Consultas para la tesis · Latencias y calidad de la monitorización
-- =============================================================
-- Todas las marcas son TIMESTAMPTZ y se comparan en UTC. Node-RED debe
-- enviarlas con `new Date().toISOString()`.
--
-- Sustituye los parámetros:
--   :desde  :hasta   periodo a analizar (UTC)
--   :actuador        código del actuador, opcional
--
-- Ejemplo con psql:
--   psql "$DATABASE_URL" -v desde="'2026-10-22 00:00+00'" \
--        -v hasta="'2026-10-23 00:00+00'" -f consultas-tesis.sql
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. LATENCIA DE COMANDOS por resultado
-- ─────────────────────────────────────────────────────────────
-- N, mínimo, promedio, p95 y máximo de la latencia total, y el reparto
-- entre ejecutados y fallidos.
--
-- `percentile_cont(0.95)` es la interpolación estándar: el valor por debajo
-- del cual queda el 95 % de las muestras. Es más informativo que el promedio
-- cuando hay valores atípicos (un comando que esperó 40 s porque Node-RED
-- estaba reiniciándose).
-- ─────────────────────────────────────────────────────────────
SELECT
  estado,
  count(*)                                                        AS n,
  round(avg(extract(epoch FROM (ejecutado_en - creado_en)))::numeric, 3)  AS promedio_s,
  round(min(extract(epoch FROM (ejecutado_en - creado_en)))::numeric, 3)  AS minimo_s,
  round(percentile_cont(0.95) WITHIN GROUP (
          ORDER BY extract(epoch FROM (ejecutado_en - creado_en))
        )::numeric, 3)                                            AS p95_s,
  round(max(extract(epoch FROM (ejecutado_en - creado_en)))::numeric, 3)  AS maximo_s,
  round(100.0 * count(*) / sum(count(*)) OVER ()::numeric, 1)     AS porcentaje
FROM comandos_actuador
WHERE creado_en >= :desde
  AND creado_en <  :hasta
  AND ejecutado_en IS NOT NULL
GROUP BY estado
ORDER BY n DESC;


-- ─────────────────────────────────────────────────────────────
-- 2. LATENCIA DESGLOSADA POR ETAPA
-- ─────────────────────────────────────────────────────────────
-- Responde «¿dónde se va el tiempo?». Cada columna es una etapa distinta:
--
--   espera_recogida  → lo que tardó Node-RED en recogerla (sondeo cada 2 s;
--                      el promedio debería rondar 1 s)
--   aplicacion_plc   → retardo real del equipo (aquí aparece la latencia
--                      simulada de 2 a 10 s del actuador)
--   ida_vuelta_api   → PATCH de confirmación + escritura en PostgreSQL
--
-- Si `aplicacion_plc` es NULL, Node-RED no envió `enviado_en`/`confirmado_en`
-- y esa fila no se puede desglosar.
-- ─────────────────────────────────────────────────────────────
SELECT
  date_trunc('minute', creado_en) AS minuto,
  count(*)                        AS n,
  round(avg(extract(epoch FROM (recogido_en   - creado_en)))::numeric, 3)   AS espera_recogida_s,
  round(avg(extract(epoch FROM (enviado_en    - recogido_en)))::numeric, 3) AS escribir_plc_s,
  round(avg(extract(epoch FROM (confirmado_en - enviado_en)))::numeric, 3)  AS aplicacion_plc_s,
  round(avg(extract(epoch FROM (ejecutado_en  - confirmado_en)))::numeric, 3) AS ida_vuelta_api_s,
  round(avg(extract(epoch FROM (ejecutado_en  - creado_en)))::numeric, 3)   AS total_s
FROM comandos_actuador
WHERE creado_en >= :desde
  AND creado_en <  :hasta
  AND estado = 'ejecutado'
GROUP BY 1
ORDER BY 1;


-- ─────────────────────────────────────────────────────────────
-- 3. TASA DE ÉXITO Y MOTIVOS DE FALLO
-- ─────────────────────────────────────────────────────────────
-- Los fallos por timeout son los que interesan para ajustar el parámetro
-- de timeout de Node-RED: si son muchos, el equipo tarda más de lo previsto.
-- ─────────────────────────────────────────────────────────────
SELECT
  count(*)                                                  AS total,
  count(*) FILTER (WHERE estado = 'ejecutado')              AS ejecutados,
  count(*) FILTER (WHERE estado = 'fallido')                AS fallidos,
  count(*) FILTER (WHERE estado = 'expirado')               AS expirados,
  round(100.0 * count(*) FILTER (WHERE estado = 'ejecutado')
        / NULLIF(count(*), 0)::numeric, 1)                  AS pct_exito,
  count(*) FILTER (
    WHERE respuesta->>'motivo' = 'timeout'
  )                                                          AS fallos_timeout
FROM comandos_actuador
WHERE creado_en >= :desde
  AND creado_en <  :hasta;


-- ─────────────────────────────────────────────────────────────
-- 4. LATENCIA DE INGESTIÓN DE MEDICIONES
-- ─────────────────────────────────────────────────────────────
-- De punta a punta: desde que el PLC generó la lectura hasta que quedó
-- guardada. Solo cuenta las mediciones que traen `origen_en`.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.codigo                                                        AS canal,
  count(*)                                                        AS n,
  round(avg(extract(epoch FROM (
          m.registrado_en - (m.metadatos->>'origen_en')::timestamptz
        )))::numeric, 3)                                          AS promedio_s,
  round(min(extract(epoch FROM (
          m.registrado_en - (m.metadatos->>'origen_en')::timestamptz
        )))::numeric, 3)                                          AS minimo_s,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY
          extract(epoch FROM (
            m.registrado_en - (m.metadatos->>'origen_en')::timestamptz
          ))
        )::numeric, 3)                                            AS p95_s,
  round(max(extract(epoch FROM (
          m.registrado_en - (m.metadatos->>'origen_en')::timestamptz
        )))::numeric, 3)                                          AS maximo_s
FROM mediciones m
JOIN canales c ON c.id = m.canal_id
WHERE m.registrado_en >= :desde
  AND m.registrado_en <  :hasta
  AND m.metadatos ? 'origen_en'
GROUP BY c.codigo
ORDER BY n DESC;


-- ─────────────────────────────────────────────────────────────
-- 5. % DE MEDICIONES REGISTRADAS (cobertura)
-- ─────────────────────────────────────────────────────────────
-- Lecturas guardadas / lecturas esperadas.
--
-- Se espera una cada `intervalo_s` segundos por canal. Con Node-RED cada
-- 15 s y una ventana de una hora: 3600 / 15 = 240 esperadas por canal.
--
-- Se usa el intervalo REAL observado entre mediciones consecutivas
-- (`lag`), no el configurado: si Node-RED en realidad tarda 17 s por ciclo,
-- comparar contra 15 daría una cobertura falsamente baja.
-- ─────────────────────────────────────────────────────────────
WITH parametros AS (
  SELECT :desde::timestamptz AS desde,
         :hasta::timestamptz AS hasta,
         15                  AS intervalo_seg   -- ← ajústalo si cambias Node-RED
),
por_canal AS (
  SELECT
    m.canal_id,
    count(*)                                    AS guardadas,
    -- Intervalo medio real entre muestras consecutivas.
    avg(extract(epoch FROM (
      m.registrado_en - lag(m.registrado_en) OVER (
        PARTITION BY m.canal_id ORDER BY m.registrado_en
      )
    )))                                         AS intervalo_real_seg
  FROM mediciones m, parametros p
  WHERE m.registrado_en >= p.desde
    AND m.registrado_en <  p.hasta
  GROUP BY m.canal_id
)
SELECT
  c.codigo                                                     AS canal,
  pc.guardadas,
  ceil(extract(epoch FROM (p.hasta - p.desde)) / p.intervalo_seg)::int AS esperadas,
  round(100.0 * pc.guardadas
        / ceil(extract(epoch FROM (p.hasta - p.desde)) / p.intervalo_seg), 1) AS pct_cobertura,
  round(pc.intervalo_real_seg::numeric, 2)                     AS intervalo_real_s
FROM por_canal pc
JOIN canales c        ON c.id = pc.canal_id
CROSS JOIN parametros p
ORDER BY pct_cobertura;


-- ─────────────────────────────────────────────────────────────
-- 6. FALLAS DE LAZO EN EL PERIODO
-- ─────────────────────────────────────────────────────────────
-- Distingue fallas de instrumento de alarmas de proceso. Sirve para
-- demostrar en la tesis que una falla NO se registra como desviación.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.codigo                                            AS canal,
  count(*) FILTER (WHERE a.tipo = 'falla_lazo')       AS fallas_lazo,
  count(*) FILTER (WHERE a.tipo = 'regla')            AS alarmas_umbral,
  round(avg(extract(epoch FROM (a.finalizada_en - a.iniciada_en))
        ) FILTER (WHERE a.tipo = 'falla_lazo')::numeric, 1) AS duracion_media_falla_s
FROM alertas a
JOIN canales c ON c.id = a.canal_id
WHERE a.iniciada_en >= :desde
  AND a.iniciada_en <  :hasta
GROUP BY c.codigo
ORDER BY fallas_lazo DESC;


-- ─────────────────────────────────────────────────────────────
-- 7. CALIDAD DE LAS MEDICIONES
-- ─────────────────────────────────────────────────────────────
-- Cuántas lecturas llegaron buenas, malas o inciertas. Si hay muchas
-- `bad`, o el sensor está fallando o la detección tiene un falso positivo.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.codigo                                            AS canal,
  count(*)                                            AS total,
  count(*) FILTER (WHERE m.calidad = 'good')          AS buenas,
  count(*) FILTER (WHERE m.calidad = 'uncertain')     AS inciertas,
  count(*) FILTER (WHERE m.calidad = 'bad')           AS malas,
  round(100.0 * count(*) FILTER (WHERE m.calidad <> 'bad')
        / NULLIF(count(*), 0)::numeric, 1)            AS pct_validas
FROM mediciones m
JOIN canales c ON c.id = m.canal_id
WHERE m.registrado_en >= :desde
  AND m.registrado_en <  :hasta
GROUP BY c.codigo
ORDER BY pct_validas;
