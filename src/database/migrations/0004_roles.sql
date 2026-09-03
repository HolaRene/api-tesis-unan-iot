-- Migración 0004: Roles actualizados.
-- Roles existentes: viewer (lectura), usuario (crea/edita/elimina), admin (todo).
-- Normaliza cualquier valor residual del rol anterior 'operador' al nuevo 'usuario'.

UPDATE usuarios
SET rol = 'usuario'
WHERE rol = 'operador';
