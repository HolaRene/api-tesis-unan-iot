-- Migración 0002: Esquema de entidades del sistema de monitoreo.
-- Todas las tablas y columnas se nombran en español (snake_case).
--
-- Orden de creación respetando dependencias:
--   usuarios y areas -> dispositivos -> tipos_variable -> sensores
--   -> mediciones -> umbrales -> alertas -> camaras -> integraciones

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  hash_contra VARCHAR(255) NOT NULL,
  rol VARCHAR(30) DEFAULT 'viewer',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50),
  descripcion TEXT,
  ubicacion VARCHAR(255),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISPOSITIVOS
-- ============================================================
CREATE TABLE IF NOT EXISTS dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES areas(id),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  fabricante VARCHAR(100),
  modelo VARCHAR(100),
  identificador VARCHAR(100) UNIQUE,
  protocolo VARCHAR(50),
  direccion_ip INET,
  estado VARCHAR(30) DEFAULT 'offline',
  metadatos JSONB DEFAULT '{}',
  ultima_conexion TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TIPOS_VARIABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_variable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  tipo_dato VARCHAR(30) NOT NULL,
  unidad_default VARCHAR(30)
);

-- ============================================================
-- SENSORES
-- ============================================================
CREATE TABLE IF NOT EXISTS sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id UUID REFERENCES dispositivos(id),
  tipo_variable_id UUID REFERENCES tipos_variable(id),
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(100) UNIQUE NOT NULL,
  fabricante VARCHAR(100),
  modelo VARCHAR(100),
  unidad VARCHAR(30),
  rango_min NUMERIC,
  rango_max NUMERIC,
  precision NUMERIC,
  activo BOOLEAN DEFAULT TRUE,
  configuracion JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEDICIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS mediciones (
  id BIGSERIAL PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES sensores(id),
  valor_numerico DOUBLE PRECISION,
  valor_texto TEXT,
  valor_booleano BOOLEAN,
  valor_json JSONB,
  calidad VARCHAR(20) DEFAULT 'good',
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadatos JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mediciones_sensor_timestamp
  ON mediciones(sensor_id, registrado_en DESC);

-- ============================================================
-- UMBRALES
-- ============================================================
CREATE TABLE IF NOT EXISTS umbrales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensores(id),
  valor_min NUMERIC,
  valor_max NUMERIC,
  severidad VARCHAR(30),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensores(id),
  medicion_id BIGINT REFERENCES mediciones(id),
  tipo VARCHAR(50),
  severidad VARCHAR(20),
  mensaje TEXT,
  estado VARCHAR(20) DEFAULT 'active',
  iniciada_en TIMESTAMPTZ DEFAULT NOW(),
  reconocida_en TIMESTAMPTZ,
  finalizada_en TIMESTAMPTZ,
  metadatos JSONB DEFAULT '{}'
);

-- ============================================================
-- CAMARAS
-- ============================================================
CREATE TABLE IF NOT EXISTS camaras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id UUID UNIQUE REFERENCES dispositivos(id),
  protocolo VARCHAR(30),
  ruta_stream TEXT,
  grabacion_habilitada BOOLEAN DEFAULT FALSE,
  configuracion JSONB DEFAULT '{}'
);

-- ============================================================
-- INTEGRACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS integraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id UUID REFERENCES dispositivos(id),
  plataforma VARCHAR(50),
  tipo VARCHAR(50),
  id_externo VARCHAR(255),
  activo BOOLEAN DEFAULT TRUE,
  configuracion JSONB DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
