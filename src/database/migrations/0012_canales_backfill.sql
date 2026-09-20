-- ============================================================
-- Migración 0012: Backfill de canales a partir de sensores.
--
-- Contexto: la migración 0009 creó la tabla `canales` (modelo
-- multivariable) pero NO generó los canales de los sensores que ya
-- existían. Como cada sensor guarda todavía una magnitud principal en
-- `tipo_variable_id`, aquí creamos un canal inicial por cada sensor que
-- no tenga ninguno, heredando unidad, rango y precisión.
--
-- Código del canal = código del sensor (la columna `canales.codigo` es
-- UNIQUE, y `sensores.codigo` también, así que no hay colisión entre
-- sensores distintos).
-- ============================================================

BEGIN;

INSERT INTO canales (
  sensor_id,
  tipo_variable_id,
  codigo,
  nombre,
  descripcion,
  unidad,
  rango_min,
  rango_max,
  precision_valor,
  activo,
  configuracion
)
SELECT
  s.id,
  s.tipo_variable_id,
  s.codigo,
  s.nombre,
  'Canal generado automáticamente a partir de la magnitud del sensor.',
  COALESCE(s.unidad, tv.unidad_default),
  s.rango_min,
  s.rango_max,
  s."precision",
  s.activo,
  '{}'::jsonb
FROM sensores s
LEFT JOIN tipos_variable tv ON tv.id = s.tipo_variable_id
WHERE NOT EXISTS (
  SELECT 1 FROM canales c WHERE c.sensor_id = s.id
)
  -- Evita choques con códigos de canal ya existentes (p. ej. creados a mano).
  AND NOT EXISTS (
    SELECT 1 FROM canales c2 WHERE c2.codigo = s.codigo
  );

COMMIT;
