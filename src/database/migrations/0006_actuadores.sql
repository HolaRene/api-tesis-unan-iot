-- Migración 0006: Tabla de actuadores.

-- Un dispositivo puede tener cero o muchos sensores y cero o muchos actuadores.
-- El área NO se guarda aquí: se obtiene vía actuador -> dispositivo -> area.

CREATE TABLE IF NOT EXISTS actuadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(100) UNIQUE NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  estado_actual VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  configuracion JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_actuadores_dispositivo_id ON actuadores(dispositivo_id);

-- Nota: sensores.codigo y dispositivos.identificador ya disponen de
-- constraint UNIQUE (que genera su propio índice); no se agregan duplicados.
