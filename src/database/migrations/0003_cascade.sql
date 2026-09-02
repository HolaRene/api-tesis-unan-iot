-- Migración 0003: Borrado en cascada (ON DELETE CASCADE).
--
-- Configura las claves foráneas para que al eliminar un registro padre
-- se eliminen automáticamente sus dependencias. Esto facilita la gestión
-- (ej: al borrar un sensor se eliminan sus mediciones, umbrales y alertas).

-- ============ MEDICIONES -> SENSORES ============
ALTER TABLE mediciones
  DROP CONSTRAINT IF EXISTS mediciones_sensor_id_fkey;
ALTER TABLE mediciones
  ADD CONSTRAINT mediciones_sensor_id_fkey
  FOREIGN KEY (sensor_id) REFERENCES sensores(id) ON DELETE CASCADE;

-- ============ UMBRALES -> SENSORES ============
ALTER TABLE umbrales
  DROP CONSTRAINT IF EXISTS umbrales_sensor_id_fkey;
ALTER TABLE umbrales
  ADD CONSTRAINT umbrales_sensor_id_fkey
  FOREIGN KEY (sensor_id) REFERENCES sensores(id) ON DELETE CASCADE;

-- ============ ALERTAS -> SENSORES ============
ALTER TABLE alertas
  DROP CONSTRAINT IF EXISTS alertas_sensor_id_fkey;
ALTER TABLE alertas
  ADD CONSTRAINT alertas_sensor_id_fkey
  FOREIGN KEY (sensor_id) REFERENCES sensores(id) ON DELETE CASCADE;

-- ============ ALERTAS -> MEDICIONES ============
ALTER TABLE alertas
  DROP CONSTRAINT IF EXISTS alertas_medicion_id_fkey;
ALTER TABLE alertas
  ADD CONSTRAINT alertas_medicion_id_fkey
  FOREIGN KEY (medicion_id) REFERENCES mediciones(id) ON DELETE CASCADE;

-- ============ SENSORES -> DISPOSITIVOS ============
ALTER TABLE sensores
  DROP CONSTRAINT IF EXISTS sensores_dispositivo_id_fkey;
ALTER TABLE sensores
  ADD CONSTRAINT sensores_dispositivo_id_fkey
  FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE;

-- ============ CAMARAS -> DISPOSITIVOS ============
ALTER TABLE camaras
  DROP CONSTRAINT IF EXISTS camaras_dispositivo_id_fkey;
ALTER TABLE camaras
  ADD CONSTRAINT camaras_dispositivo_id_fkey
  FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE;

-- ============ INTEGRACIONES -> DISPOSITIVOS ============
ALTER TABLE integraciones
  DROP CONSTRAINT IF EXISTS integraciones_dispositivo_id_fkey;
ALTER TABLE integraciones
  ADD CONSTRAINT integraciones_dispositivo_id_fkey
  FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE;

-- ============ DISPOSITIVOS -> AREAS ============
ALTER TABLE dispositivos
  DROP CONSTRAINT IF EXISTS dispositivos_area_id_fkey;
ALTER TABLE dispositivos
  ADD CONSTRAINT dispositivos_area_id_fkey
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE;
