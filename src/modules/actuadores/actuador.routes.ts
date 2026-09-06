import { Router } from 'express';
import { actuadorController } from './actuador.controller.js';
import { comandoActuadorController } from '../comandos-actuador/comando-actuador.controller.js';
import { middlewareAuth } from '../../middlewares/auth.middleware.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';

/**
 * Rutas del módulo de actuadores, montadas bajo /api/v1/actuadores.
 * Requieren JWT. La lectura es abierta a cualquier rol autenticado;
 * crear/editar/eliminar y enviar comandos requieren rol `usuario` o `admin`.
 */
const router = Router();

router.use(middlewareAuth);

// Lectura (cualquier autenticado)
router.get('/', actuadorController.listar);
router.get('/:id', actuadorController.obtenerPorId);
router.get('/:id/comandos', comandoActuadorController.listar);

// Escritura (usuario/admin)
router.post('/', requiereRol('usuario', 'admin'), actuadorController.crear);
router.patch('/:id', requiereRol('usuario', 'admin'), actuadorController.actualizar);
router.delete('/:id', requiereRol('usuario', 'admin'), actuadorController.eliminar);

// Comando en un actuador (usuario/admin)
router.post('/:id/comandos', requiereRol('usuario', 'admin'), comandoActuadorController.crearEnActuador);

export default router;
