-- Migración 0007: Tabla de comandos de actuadores.

-- Permite trazabilidad completa:
--   - qué actuador recibe el comando
--   - quién lo originó (usuario web o API Key, no ambos obligatorios)
--   - qué comando y valor se solicitó
--   - estados: pendiente, enviado, ejecutado, fallido, cancelado
--   - fechas de creación/envío/ejecución y respuesta

CREATE TABLE IF NOT EXISTS comandos_actuador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actuador_id UUID NOT NULL REFERENCES actuadores(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  clave_api_id UUID REFERENCES claves_api(id) ON DELETE SET NULL,
  comando VARCHAR(100) NOT NULL,
  valor JSONB,
  estado VARCHAR(30) DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  enviado_en TIMESTAMPTZ,
  ejecutado_en TIMESTAMPTZ,
  respuesta JSONB,
  metadatos JSONB DEFAULT '{}'
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_comandos_actuador_actuador_creado
  ON comandos_actuador(actuador_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_comandos_actuador_usuario_id ON comandos_actuador(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comandos_actuador_clave_api_id ON comandos_actuador(clave_api_id);
