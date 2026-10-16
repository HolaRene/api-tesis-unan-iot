-- ────────────────────────────────────────────────────────────────────
-- 0016 · DIRECCIONAMIENTO DE ACTUADORES
-- ────────────────────────────────────────────────────────────────────
-- PROBLEMA QUE RESUELVE
--
-- Hasta ahora el comando llevaba el CÓDIGO del actuador:
--
--     { "actuador": "LED-1", "comando": "ON" }
--
-- Eso sirve para un ESP32 (que busca qué pin corresponde a "LED-1"), pero
-- NO para un PLC. Un PLC no sabe qué es "LED-1": solo entiende
--
--     "en la dirección 100, pon un 1"
--
-- y eso activa lo que esté cableado a esa salida. La dirección física es
-- un dato de la INSTALACIÓN, no del software, así que tiene que poder
-- configurarse por actuador.
--
-- SOLUCIÓN
--
-- 1. Columna `protocolo`: cómo se acciona este actuador.
--      modbus → coil/registro + dirección (PLC)
--      gpio   → número de pin (ESP32/Arduino)
--      mqtt   → tema propio
--      http   → URL de un endpoint
--
-- 2. El detalle de la dirección vive en `configuracion` (JSONB), que ya
--    existía pero estaba sin usar. Se deja en JSONB en lugar de columnas
--    fijas porque cada protocolo necesita campos distintos, y así añadir
--    uno nuevo no exige migrar la tabla.
--
-- Por qué el protocolo va como columna y no dentro del JSON: permite
-- filtrar y contar por tipo con SQL normal, sin operadores de JSONB.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE actuadores
  ADD COLUMN IF NOT EXISTS protocolo VARCHAR(30) NOT NULL DEFAULT 'mqtt';

-- Solo se admiten los protocolos implementados. `mqtt` es el valor por
-- defecto para no romper las filas existentes, que funcionaban publicando
-- al tema derivado de su código.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'actuadores_protocolo_check'
  ) THEN
    ALTER TABLE actuadores
      ADD CONSTRAINT actuadores_protocolo_check
      CHECK (protocolo IN ('modbus', 'gpio', 'mqtt', 'http'));
  END IF;
END $$;

-- Índice para agrupar por protocolo en los listados.
CREATE INDEX IF NOT EXISTS idx_actuadores_protocolo
  ON actuadores (protocolo);

COMMENT ON COLUMN actuadores.protocolo IS
  'Cómo se acciona: modbus (PLC), gpio (ESP32), mqtt (tema propio) o http (URL).';

COMMENT ON COLUMN actuadores.configuracion IS
  'Direccionamiento según el protocolo. modbus: {tipo, direccion, unidad_id}. gpio: {pin, nivel_activo}. mqtt: {topico}. http: {url, metodo}.';
