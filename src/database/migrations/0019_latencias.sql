-- =============================================================
-- 0019 · Marcas de tiempo para medir latencias
-- =============================================================
-- POR QUÉ
--
-- Para la tesis hay que poder responder: «¿cuánto tarda una orden desde que
-- el operario la pulsa hasta que el equipo la ejecuta?» y «¿dónde se va ese
-- tiempo?».
--
-- Con `creado_en` y `ejecutado_en` solo se conoce el total. Si tarda 8 s,
-- no se sabe si Node-RED tardó en recogerla, el PLC en aplicarla o la API en
-- registrarlo.
--
-- Se añaden dos marcas intermedias:
--
--   creado_en     (API)   orden registrada en PostgreSQL
--   recogido_en   (N-RED) Node-RED la obtuvo de /iot/comandos/pendientes
--   enviado_en    (N-RED) orden escrita en el PLC
--   confirmado_en (N-RED) lectura de vuelta correcta
--   ejecutado_en  (API)   estado final 'ejecutado' persistido
--
--   latencia_total       = ejecutado_en  - creado_en
--   latencia_recogida    = recogido_en   - creado_en     (espera de sondeo)
--   latencia_aplicacion  = confirmado_en - enviado_en    (retardo del equipo)
--   latencia_confirmacion= ejecutado_en  - confirmado_en (ida y vuelta HTTP)
--
-- ⚠️ RELOJ: todas las marcas se comparan en UTC. Las columnas son
-- TIMESTAMPTZ, que PostgreSQL guarda en UTC internamente, así que son
-- comparables aunque los equipos estén en husos distintos. Node-RED debe
-- enviar `new Date().toISOString()` (siempre UTC con sufijo Z).
-- =============================================================

ALTER TABLE comandos_actuador
  ADD COLUMN IF NOT EXISTS recogido_en   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmado_en TIMESTAMPTZ;

COMMENT ON COLUMN comandos_actuador.recogido_en IS
  'Instante (UTC) en que Node-RED obtuvo el comando de /iot/comandos/pendientes.';
COMMENT ON COLUMN comandos_actuador.confirmado_en IS
  'Instante (UTC) en que Node-RED verificó por lectura de vuelta que el estado pedido se alcanzó.';

-- Para agrupar y analizar por periodo sin escanear toda la tabla.
CREATE INDEX IF NOT EXISTS idx_comandos_actuador_creado_en
  ON comandos_actuador(creado_en DESC);

-- =============================================================
-- Latencia de ingestión de mediciones
-- =============================================================
-- `registrado_en` es cuando la API guardó el dato. Falta cuándo se GENERÓ
-- (en el PLC o en Node-RED), que es lo que permite medir de punta a punta.
--
-- No se añade una columna: la tabla de mediciones es la de mayor volumen y
-- una columna nueva obliga a reescribirla. Se guarda en `metadatos`, que ya
-- existe, y se indexa con una expresión para poder consultarla rápido.
--
-- Si el integrador no envía `origen_en`, queda NULL y esa medición no entra
-- en el cálculo de latencia (pero sí en todo lo demás).
CREATE INDEX IF NOT EXISTS idx_mediciones_origen_en
  ON mediciones (((metadatos->>'origen_en')))
  WHERE metadatos ? 'origen_en';

COMMENT ON COLUMN mediciones.metadatos IS
  'Incluye origen_en (ISO 8601 UTC): instante en que el PLC/Node-RED generó la lectura, para medir latencia extremo a extremo.';
