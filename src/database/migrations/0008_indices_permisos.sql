-- Migración 0008: Índices complementarios (permisos y búsquedas).

-- Índice por prefijo de API Key: útil para localizar la clave al validar.
CREATE INDEX IF NOT EXISTS idx_claves_api_prefijo ON claves_api(prefijo);

-- Listar sensores por dispositivo (común en consultas relacionales).
CREATE INDEX IF NOT EXISTS idx_sensores_dispositivo_id ON sensores(dispositivo_id);

-- NOTA: no se duplican los índices UNIQUE existentes:
--   dispositivos.identificador (UNIQUE) y sensores.codigo (UNIQUE).
-- Estos ya generan su propio índice para búsqueda por esos campos.
