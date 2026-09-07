-- ============================================================
-- Migración 0009: Modelo multivariable - fase 1 (canales).
-- No cambia el esquema de áreas/dispositivos/sensores existentes,
-- pero la nueva referencia de las mediciones será `canal_id`.
-- ============================================================

BEGIN;

-- 1) Vaciar datos operativos (no borra usuarios ni tipos_variable)
TRUNCATE TABLE
  comandos_actuador,
  actuadores,
  claves_api,
  integraciones,
  camaras,
  alertas,
  umbrales,
  mediciones,
  sensores,
  dispositivos,
  areas
RESTART IDENTITY CASCADE;

-- 2) Ampliar catálogo de tipos_variable (multivariable + categoría)
ALTER TABLE tipos_variable
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(60);
ALTER TABLE tipos_variable
  ADD COLUMN IF NOT EXISTS permite_reglas BOOLEAN NOT NULL DEFAULT TRUE;

-- 3) Nueva tabla: CANALES (magnitud física concreta de un sensor)
CREATE TABLE IF NOT EXISTS canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensores(id) ON DELETE CASCADE,
  tipo_variable_id UUID REFERENCES tipos_variable(id),
  codigo VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  unidad VARCHAR(30),
  rango_min NUMERIC,
  rango_max NUMERIC,
  precision_valor NUMERIC,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  configuracion JSONB NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Mediciones: nueva referencia a canal (provisionalmente nullable para backfill)
ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS canal_id UUID REFERENCES canales(id) ON DELETE CASCADE;
ALTER TABLE mediciones
  ALTER COLUMN sensor_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mediciones_canal_timestamp
  ON mediciones(canal_id, registrado_en DESC);

COMMIT;
