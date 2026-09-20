-- ============================================================
-- 0014_camaras_ip.sql
--
-- Amplía la tabla `camaras` para el módulo de cámaras IP.
--
-- La tabla original (0002) era un anexo de `dispositivos`:
--   - dispositivo_id era NOT NULL de facto (UNIQUE + CASCADE)
--   - no tenía nombre, estado, área ni ruta WebRTC
--
-- El módulo de cámaras IP necesita que la cámara sea una entidad
-- INDEPENDIENTE, opcionalmente asociada a un área y a un dispositivo.
--
-- IMPORTANTE (seguridad): NO se guardan credenciales RTSP.
--   - `ruta_stream` es solo el PATH del stream (p. ej. `/stream1`).
--   - `direccion_ip` + `puerto_rtsp` permiten reconstruir la URL solo
--     en el servidor/MediaMTX, nunca en el navegador.
--   - Las credenciales, si existen, van en la configuración de MediaMTX.
--
-- IDEMPOTENTE: se puede aplicar varias veces sin efectos secundarios.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas nuevas
-- ------------------------------------------------------------
ALTER TABLE camaras
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(120),
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direccion_ip INET,
  ADD COLUMN IF NOT EXISTS puerto_rtsp INTEGER DEFAULT 554,
  ADD COLUMN IF NOT EXISTS ruta_webrtc VARCHAR(120),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'desconectada',
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ultima_conexion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadatos JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Propiedad del recurso (aislamiento por usuario, ver 0013).
ALTER TABLE camaras
  ADD COLUMN IF NOT EXISTS propietario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2) dispositivo_id pasa a ser OPCIONAL
--    Una cámara puede existir sin dispositivo asociado.
-- ------------------------------------------------------------
ALTER TABLE camaras
  ALTER COLUMN dispositivo_id DROP NOT NULL;

-- La restricción UNIQUE original impide varias cámaras por dispositivo y
-- no está en el modelo nuevo. Se sustituye por un índice no único.
ALTER TABLE camaras
  DROP CONSTRAINT IF EXISTS camaras_dispositivo_id_key;

-- La FK original era ON DELETE CASCADE: borrar un dispositivo borraba su
-- cámara. Ahora la cámara es independiente -> SET NULL.
ALTER TABLE camaras
  DROP CONSTRAINT IF EXISTS camaras_dispositivo_id_fkey;

ALTER TABLE camaras
  ADD CONSTRAINT camaras_dispositivo_id_fkey
  FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3) Estado válido (mismo criterio que el resto del sistema)
-- ------------------------------------------------------------
ALTER TABLE camaras
  DROP CONSTRAINT IF EXISTS camaras_estado_check;

ALTER TABLE camaras
  ADD CONSTRAINT camaras_estado_check
  CHECK (estado IN ('activa', 'inactiva', 'conectada', 'desconectada', 'error'));

-- ------------------------------------------------------------
-- 4) `activa` debe ser coherente con el estado
--    (se deja al servicio, aquí solo el NOT NULL y el default)
-- ------------------------------------------------------------
UPDATE camaras SET estado = 'desconectada' WHERE estado IS NULL;
UPDATE camaras SET nombre = 'Cámara ' || substr(id::text, 1, 8)
  WHERE nombre IS NULL;

-- ------------------------------------------------------------
-- 5) Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_camaras_area
  ON camaras (area_id);
CREATE INDEX IF NOT EXISTS idx_camaras_dispositivo
  ON camaras (dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_camaras_propietario
  ON camaras (propietario_id);
CREATE INDEX IF NOT EXISTS idx_camaras_estado
  ON camaras (estado);

-- `ruta_webrtc` debe ser única por servidor MediaMTX: dos cámaras con la
-- misma ruta colisionarían en el stream.
CREATE UNIQUE INDEX IF NOT EXISTS idx_camaras_ruta_webrtc_unica
  ON camaras (ruta_webrtc)
  WHERE ruta_webrtc IS NOT NULL;

-- ------------------------------------------------------------
-- 6) Backfill de propiedad (cámaras existentes -> admin más antiguo)
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
    RAISE NOTICE 'No hay admin: las cámaras quedan globales.';
    RETURN;
  END IF;

  UPDATE camaras SET propietario_id = admin_id WHERE propietario_id IS NULL;
  RAISE NOTICE 'Backfill de cámaras completado (admin %).', admin_id;
END $$;
