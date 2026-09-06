-- Migración 0005: Tabla de API Keys por usuario.

-- Claves para integraciones máquina a máquina (Node-RED, scripts, gateways, IoT).
-- Solo se guarda un hash verificable de la clave y un prefijo visible.
-- La clave completa se muestra una única vez en el momento de crearla.

CREATE TABLE IF NOT EXISTS claves_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  prefijo VARCHAR(30) NOT NULL,
  hash_clave VARCHAR(255) NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  permisos JSONB DEFAULT '{}',
  ultimo_uso TIMESTAMPTZ,
  expira_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_claves_api_usuario_id ON claves_api(usuario_id);
