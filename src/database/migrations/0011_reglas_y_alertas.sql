-- Migración 0011: reglas de alerta por canal y ampliación de alertas.
BEGIN;

-- 1) Reglas de alerta
CREATE TABLE IF NOT EXISTS reglas_alerta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  operador VARCHAR(40) NOT NULL,
  valor_referencia_numerico NUMERIC,
  valor_referencia_texto TEXT,
  valor_referencia_booleano BOOLEAN,
  valor_min NUMERIC,
  valor_max NUMERIC,
  severidad VARCHAR(20) NOT NULL DEFAULT 'warning',
  mensaje TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  retardo_segundos INTEGER,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reglas_canal_activa
  ON reglas_alerta(canal_id) WHERE activa = TRUE;

-- 2) Alertas: conservo sensor_id/medicion_id antiguos (compat), agrego canal y regla
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS canal_id UUID REFERENCES canales(id) ON DELETE CASCADE;
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS regla_id UUID REFERENCES reglas_alerta(id) ON DELETE SET NULL;
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS valor_disparador_numerico NUMERIC;
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS valor_disparador_texto TEXT;
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS valor_disparador_booleano BOOLEAN;
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS reconocida_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alertas_canal_estado
  ON alertas(canal_id, estado);
CREATE INDEX IF NOT EXISTS idx_alertas_regla_estado
  ON alertas(regla_id, estado);

COMMIT;
