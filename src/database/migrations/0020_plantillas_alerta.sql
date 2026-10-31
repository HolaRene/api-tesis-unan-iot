-- =============================================================
-- 0020 · Normas (plantillas de alerta) en base de datos
-- =============================================================
-- POR QUÉ
--
-- Hasta ahora las plantillas eran archivos JSON en `src/plantillas-alerta/`.
-- Eso servía para las normas oficiales (ASHRAE 170, ISO 14644…), que cambian
-- cada varios años y conviene tener versionadas en el repositorio.
--
-- Pero la plataforma es GENÉRICA: un usuario debe poder crear su propia
-- norma («Invernadero», «Cámara fría») sin tocar código ni reiniciar la API.
-- Con archivos eso es imposible.
--
-- Se mueven a base de datos conservando los JSON como origen del sembrado:
--
--   origen = 'sistema'  → vino de un JSON del repositorio. Se puede editar,
--                         pero NO borrar: si se borrara, la próxima siembra
--                         la volvería a crear y el usuario no entendería por
--                         qué reaparece.
--   origen = 'usuario'  → la creó un administrador. Se puede borrar.
--
-- Las REGLAS de la norma se guardan en la propia fila (`reglas` JSONB) y no
-- en `reglas_alerta`: no son reglas activas de ningún canal, son una
-- definición. Al aplicarlas a un área se COPIAN a `reglas_alerta`, que es
-- lo que usa el motor de alertas y la clasificación de niveles.
-- =============================================================

CREATE TABLE IF NOT EXISTS plantillas_alerta (
  id            VARCHAR(80)  PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  norma         VARCHAR(200) NOT NULL,
  notas         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  reglas        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  origen        VARCHAR(20)  NOT NULL DEFAULT 'usuario'
                CHECK (origen IN ('sistema', 'usuario')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE plantillas_alerta IS
  'Normas de referencia (ASHRAE 170, ISO 14644…) y perfiles propios. Al aplicarlas a un área se copian sus reglas a reglas_alerta.';
COMMENT ON COLUMN plantillas_alerta.origen IS
  'sistema = sembrada desde src/plantillas-alerta (no borrable); usuario = creada desde la web.';
COMMENT ON COLUMN plantillas_alerta.reglas IS
  'Array JSON de reglas: variable, tipos_variable[], operador, valor_min/max, severidad, retardo_segundos, histeresis, mensaje.';

CREATE INDEX IF NOT EXISTS idx_plantillas_alerta_origen
  ON plantillas_alerta(origen);

-- =============================================================
-- Sembrado desde los JSON del repositorio
-- =============================================================
-- Se hace en el código (`sembrarPlantillasDesdeJson`), no con INSERT a mano:
-- así los JSON siguen siendo la fuente de verdad de las normas oficiales y
-- añadir un archivo nuevo no obliga a escribir SQL.
--
-- Esta migración solo crea la tabla. El sembrado se ejecuta al arrancar la
-- API (idempotente: INSERT ... ON CONFLICT DO UPDATE solo si origen=sistema).
