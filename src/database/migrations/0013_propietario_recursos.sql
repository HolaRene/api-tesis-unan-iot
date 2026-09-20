-- ============================================================
-- 0013_propietario_recursos.sql
--
-- Aislamiento de datos por usuario (propiedad de recursos).
--
-- DISEÑO: el propietario se guarda SOLO en las tablas RAÍZ:
--   - areas        (raíz de la jerarquía de ubicación)
--   - dispositivos (raíz de la jerarquía de equipos)
--
-- El resto de recursos heredan la propiedad por su padre:
--   dispositivo.area_id       -> areas.propietario_id
--   sensor.dispositivo_id     -> dispositivos.propietario_id
--   canal.sensor_id           -> (sensor) -> dispositivos
--   regla.canal_id            -> (canal)  -> dispositivos
--   medicion.canal_id         -> (canal)  -> dispositivos
--   alerta.regla_id/canal_id  -> (canal)  -> dispositivos
--   camara/integracion        -> dispositivo_id
--
-- Así no hay riesgo de que un hijo apunte a un dueño distinto que su padre.
--
-- REGLA DE VISIBILIDAD:
--   - `admin`   ve TODO.
--   - resto     ve solo lo suyo (propietario_id = su id), y heredan los hijos.
--   - `NULL`    = recurso global/compartido, visible por todos (y editable
--               solo por admin).
--
-- BACKFILL: los recursos existentes (sin dueño) se asignan al admin más
-- antiguo, de modo que los usuarios nuevos empiecen de cero.
--
-- IDEMPOTENTE: se puede aplicar varias veces sin efectos secundarios.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas de propiedad
-- ------------------------------------------------------------
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS propietario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS propietario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2) Índices para el filtrado por propietario (listados frecuentes)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_areas_propietario
  ON areas (propietario_id);

CREATE INDEX IF NOT EXISTS idx_dispositivos_propietario
  ON dispositivos (propietario_id);

CREATE INDEX IF NOT EXISTS idx_dispositivos_area
  ON dispositivos (area_id);

-- ------------------------------------------------------------
-- 3) Backfill: lo existente pasa al admin más antiguo
-- ------------------------------------------------------------
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id
  FROM usuarios
  WHERE rol = 'admin'
  ORDER BY creado_en ASC
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'No hay ningún admin: se omite el backfill (los recursos quedan globales).';
    RETURN;
  END IF;

  UPDATE areas
  SET propietario_id = admin_id
  WHERE propietario_id IS NULL;

  UPDATE dispositivos
  SET propietario_id = admin_id
  WHERE propietario_id IS NULL;

  RAISE NOTICE 'Backfill completado: recursos existentes asignados al admin %.', admin_id;
END $$;
