-- Migración 0010: semilla del catálogo tipos_variable (multivariable)
-- sobreescribe/reinserta el catálogo de magnitudes según el plan.
-- Idempotente via ON CONFLICT(codigo).
BEGIN;

DELETE FROM tipos_variable; -- limpiar viejos (canales/sensores vacíos)

INSERT INTO tipos_variable (codigo, nombre, descripcion, tipo_dato, unidad_default, categoria, permite_reglas) VALUES
  ('TEMPERATURA',        'Temperatura',        'Magnitud térmica.',                                        'numeric', '°C',  'ambiental', TRUE),
  ('HUMEDAD_RELATIVA',   'Humedad relativa',   'Porcentaje de humedad relativa.',                          'numeric', '%',   'ambiental', TRUE),
  ('PRESION',            'Presión',            'Presión atmosférica o barométrica.',                       'numeric', 'hPa', 'ambiental', TRUE),
  ('CO2',                'CO2',                'Dióxido de carbono.',                                      'numeric', 'ppm', 'ambiental', TRUE),
  ('VOC',                'Compuestos orgánicos volátiles','Vigilancia calidad de aire.',                   'numeric', 'ppm', 'ambiental', TRUE),
  ('VOLTAJE',            'Voltaje',            'Tensión eléctrica.',                                       'numeric', 'V',   'electrica', TRUE),
  ('CORRIENTE',          'Corriente',          'Intensidad eléctrica.',                                    'numeric', 'A',   'electrica', TRUE),
  ('POTENCIA',           'Potencia',           'Potencia eléctrica activa.',                               'numeric', 'W',   'electrica', TRUE),
  ('FRECUENCIA',         'Frecuencia',         'Frecuencia de la señal.',                                  'numeric', 'Hz', 'electrica', TRUE),
  ('FACTOR_POTENCIA',    'Factor de potencia', 'Relación potencia útil/aparente (0–1).',                  'numeric', '',    'electrica', TRUE),
  ('NIVEL',              'Nivel',              'Nivel de líquido, tanque o tolva.',                        'numeric', '%',   'industrial', TRUE),
  ('ESTADO_MOTOR',       'Estado motor',       'Estado on/off de un motor o actuador.',                    'boolean', '',   'estado', TRUE),
  ('ESTADO_ENCHUFADO',   'Estado enchufado',   'Estado de un contacto o puerta (abierto/cerrado).',        'boolean', '',   'estado', TRUE),
  ('ESTADO_SISTEMA',     'Estado sistema',     'Texto de estado del sistema (ok, error, mantenimiento...).','text',   '',    'estado', TRUE),
  ('TIPO_EVENTO',        'Tipo evento',        'Texto libre que describe un evento o mensaje.',            'text',   '',    'estado', FALSE),
  ('CONFIG_JSON',        'Configuración JSON', 'Magnitud genérica sin reglas (JSON).',                     'json',   '',    'configuracion', FALSE);

COMMIT;
