-- =============================================================
-- 0017 · Histéresis en las reglas de alerta
-- =============================================================
-- POR QUÉ
--
-- Hasta ahora una alerta se abría en cuanto el valor salía de la banda y se
-- cerraba en el instante en que volvía a entrar. Con un valor que oscila en
-- el borde (23,98 / 24,02 / 23,99…) eso produce una alerta por cada medición:
-- decenas de avisos por minuto que nadie puede atender.
--
-- La HISTÉRESIS exige volver a la banda con un margen antes de cerrar. Una
-- regla «fuera de 20–24 °C» con histéresis 0,5 no se resuelve hasta que el
-- valor entra en 20,5–23,5. Así el umbral de apertura y el de cierre son
-- distintos, y el ruido del borde deja de generar avisos.
--
-- Es lo que pide ISA-18.2 / IEC 62682 para toda alarma.
--
-- El tipo es NUMERIC y no INTEGER porque las magnitudes lo necesitan:
-- 0,5 °C, 0,5 Pa, 5 % del límite…
--
-- NULL = sin histéresis (comportamiento anterior). Las reglas existentes
-- siguen funcionando igual.
-- =============================================================

ALTER TABLE reglas_alerta
  ADD COLUMN IF NOT EXISTS histeresis NUMERIC(12, 4);

COMMENT ON COLUMN reglas_alerta.histeresis IS
  'Margen para cerrar la alerta una vez el valor vuelve a la banda. NULL = sin margen (cierra en cuanto entra).';

-- Índice para localizar alertas abiertas de una regla al evaluar.
CREATE INDEX IF NOT EXISTS idx_alertas_regla_abiertas
  ON alertas(regla_id)
  WHERE estado IN ('active', 'acknowledged');

-- =============================================================
-- Cronómetro del retardo
-- =============================================================
-- Una regla con `retardo_segundos = 60` debe alarmar solo si la condición
-- se mantiene un minuto. Para eso hay que recordar CUÁNDO empezó a
-- cumplirse, entre una medición y la siguiente.
--
-- No se guarda en la regla porque es estado por regla, no configuración, y
-- se borra en cuanto la condición deja de cumplirse o se abre la alerta.
--
-- La clave primaria sobre `regla_id` garantiza una sola fila por regla y
-- permite el `ON CONFLICT DO NOTHING` que no reinicia el cronómetro.
-- =============================================================

CREATE TABLE IF NOT EXISTS alertas_retardo (
  regla_id UUID PRIMARY KEY REFERENCES reglas_alerta(id) ON DELETE CASCADE,
  desde    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alertas_retardo IS
  'Cronómetro de las reglas cuya condición se está cumpliendo pero aún no alcanza el retardo para alarmar.';
