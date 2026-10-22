-- =============================================================
-- 0018 · Perfil normativo del área y trazabilidad de las reglas
-- =============================================================
-- POR QUÉ
--
-- 1) PERFIL DEL ÁREA
--
--    Saber «si se cumple la norma» exige saber a qué norma se somete el
--    recinto. Un quirófano y un centro de datos tienen bandas distintas para
--    la misma magnitud: 20–24 °C frente a 18–27 °C.
--
--    El perfil se declara en el ÁREA porque la norma aplica al recinto
--    (quirófano, sala limpia, sala de servidores), no al sensor ni al
--    dispositivo concreto.
--
--    Guarda solo el `id` de la plantilla (p. ej. 'quirofano-ashrae-170').
--    No se usa clave foránea porque las plantillas son archivos del
--    repositorio, no filas de la base.
--
-- 2) ORIGEN NORMATIVO DE LA REGLA
--
--    Cuando una regla se crea desde una plantilla, hay que poder responder:
--    ¿de qué norma sale?, ¿qué valor está pendiente de confirmar?
--
--    Sin eso, una regla «Temperatura fuera de 20 a 24 °C» es indistinguible
--    de una inventada a mano, y en una tesis la procedencia importa.
--
--    Se guarda:
--      - plantilla_id : 'quirofano-ashrae-170'
--      - norma        : 'ASHRAE 170 — Ventilación…'
--      - requiere_verificacion : true si el valor llevaba marca [verificar]
--
--    Las tres son NULL en las reglas creadas a mano: así se distingue
--    «regla de norma» de «regla del proyecto».
-- =============================================================

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS perfil_alerta VARCHAR(80);

COMMENT ON COLUMN areas.perfil_alerta IS
  'Id de la plantilla de alertas aplicable al recinto (p. ej. quirofano-ashrae-170). NULL = sin perfil declarado.';

ALTER TABLE reglas_alerta
  ADD COLUMN IF NOT EXISTS plantilla_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS norma VARCHAR(200),
  ADD COLUMN IF NOT EXISTS requiere_verificacion BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN reglas_alerta.plantilla_id IS
  'Plantilla de la que se creó la regla. NULL si se creó a mano.';
COMMENT ON COLUMN reglas_alerta.norma IS
  'Norma de referencia heredada de la plantilla.';
COMMENT ON COLUMN reglas_alerta.requiere_verificacion IS
  'El valor procede de una fuente sin confirmar y está marcado [verificar].';

-- Para listar las reglas de un área agrupadas por norma.
CREATE INDEX IF NOT EXISTS idx_reglas_alerta_plantilla
  ON reglas_alerta(plantilla_id)
  WHERE plantilla_id IS NOT NULL;
