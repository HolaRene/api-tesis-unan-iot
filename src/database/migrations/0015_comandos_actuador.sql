-- ============================================================
-- Migración 0015: comandos de actuadores (circuito completo).
--
-- Hasta ahora el circuito estaba a medias: la web guardaba el comando en
-- `comandos_actuador` con estado 'pendiente', pero NADIE los recogía ni los
-- entregaba al dispositivo. Faltaba:
--
--   1. Que Node-RED pudiera CONSULTAR los pendientes (se resuelve con código,
--      no necesita columnas nuevas).
--   2. Marcar el comando como enviado/ejecutado (las columnas ya existían).
--   3. Saber a QUÉ TEMA MQTT publicar cada comando  → `topico_mqtt`.
--   4. Reflejar en el actuador el último cambio      → `ultima_orden_en`.
--
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

BEGIN;

-- 1) Tema MQTT por actuador.
--
-- Cada actuador tiene su propio tema (p. ej. "hospital/quirofano/cmd/RELE-1"),
-- de modo que el ESP32/PLC solo se suscribe al suyo y no recibe órdenes de
-- otros equipos.
--
-- Si queda NULL, Node-RED construye uno por defecto a partir del código; así
-- la columna es opcional y no rompe los actuadores ya existentes.
ALTER TABLE actuadores
  ADD COLUMN IF NOT EXISTS topico_mqtt VARCHAR(200);

-- 2) Fecha del último cambio de estado real del actuador.
--
-- `estado_actual` ya existía, pero no cuándo cambió. Sirve para saber si el
-- dispositivo confirmó la orden o si sigue en el valor anterior.
ALTER TABLE actuadores
  ADD COLUMN IF NOT EXISTS ultima_orden_en TIMESTAMPTZ;

-- 3) Índice para la consulta de comandos pendientes.
--
-- Node-RED pregunta cada pocos segundos por los comandos en estado
-- 'pendiente'. Sin índice, esa consulta recorre la tabla entera.
CREATE INDEX IF NOT EXISTS idx_comandos_actuador_pendientes
  ON comandos_actuador (creado_en)
  WHERE estado = 'pendiente';

-- 4) Comentarios de documentación (quedan en la BD).
COMMENT ON COLUMN actuadores.topico_mqtt IS
  'Tema MQTT al que Node-RED publica las órdenes de este actuador. Si es NULL, se deriva del código.';
COMMENT ON COLUMN actuadores.ultima_orden_en IS
  'Momento del último cambio de estado confirmado por el dispositivo.';

COMMIT;
