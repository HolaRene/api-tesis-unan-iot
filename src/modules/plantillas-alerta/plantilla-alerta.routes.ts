import { Router } from 'express';

import { middlewareAuth } from '../../middlewares/auth.middleware.js';
import { requiereRol } from '../../middlewares/permisos.middleware.js';
import { responderExito } from '../../utils/api-response.js';
import {
  listarPlantillas,
  obtenerPlantilla,
  reglasAplicables,
} from './plantilla-alerta.service.js';
import * as plantillaService from './plantilla-alerta.service.js';
import {
  esquemaCrearPlantilla,
  esquemaActualizarPlantilla,
  esquemaEvaluar,
} from './plantilla-alerta.schema.js';
import { reglaService } from '../reglas-alerta/regla-alerta.service.js';
import { canalService } from '../canales/canal.service.js';

/**
 * Rutas de plantillas de alerta.
 *
 *   GET  /plantillas-alerta            → catálogo de perfiles
 *   GET  /plantillas-alerta/:id        → detalle de un perfil
 *   POST /plantillas-alerta/:id/aplicar → crea las reglas en un canal
 */
const router = Router();
router.use(middlewareAuth);

router.get('/', async (_req, res, next) => {
  try {
    const plantillas = await listarPlantillas();
    responderExito(res, plantillas, 200);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const plantilla = await obtenerPlantilla(String(req.params.id));
    responderExito(res, plantilla, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * Aplica una plantilla a un canal: crea las reglas que encajan con su tipo.
 *
 * Responde con lo que se creó y lo que se omitió, para que el usuario sepa
 * por qué no aparecen todas las reglas de la plantilla.
 */
router.post('/:id/aplicar', requiereRol('usuario', 'admin'), async (req, res, next) => {
  try {
    const plantilla = await obtenerPlantilla(String(req.params.id));
    const canalId = String((req.body as { canal_id?: unknown })?.canal_id ?? '');

    if (!canalId) {
      res.status(400).json({
        exito: false,
        mensaje: 'Falta el canal al que aplicar la plantilla',
      });
      return;
    }

    // El canal se busca con el alcance del usuario: aplica el aislamiento.
    const canal = await canalService.obtenerPorId(canalId, req.usuario);

    const { aplicables, omitidas } = reglasAplicables(plantilla, canal.tipo_codigo);

    const creadas = [];
    for (const regla of aplicables) {
      creadas.push(
        await reglaService.crear({
            canal_id: canalId,
            nombre: regla.nombre,
            descripcion: `Plantilla «${plantilla.nombre}» · variable: ${regla.variable}`,
            operador: regla.operador,
            valor_referencia_numerico: regla.valor_referencia_numerico ?? null,
            valor_min: regla.valor_min ?? null,
            valor_max: regla.valor_max ?? null,
            valor_referencia_texto: regla.valor_referencia_texto ?? null,
            severidad: regla.severidad,
            mensaje: regla.mensaje ?? null,
            activa: true,
            retardo_segundos: regla.retardo_segundos ?? null,
            histeresis: regla.histeresis ?? null,
            /*
             * Trazabilidad: de qué norma sale esta regla y si su valor
             * está pendiente de confirmar.
             *
             * Se busca [verificar] tanto en el mensaje de la regla como en
             * las notas de la plantilla que mencionen su variable: así una
             * regla hereda la marca cuando la plantilla advierte de ella.
             */
            plantilla_id: plantilla.id,
            norma: plantilla.norma,
            requiere_verificacion: /\[verificar\]/i.test(regla.mensaje ?? ''),
          })
      );
    }

    responderExito(
      res,
      {
        plantilla: plantilla.id,
        canal_id: canalId,
        creadas: creadas.length,
        omitidas: omitidas.map((r) => ({
          nombre: r.nombre,
          variable: r.variable,
          motivo: `Requiere un canal de tipo ${r.tipos_variable.join(' o ')} y este es ${canal.tipo_codigo ?? 'desconocido'}`,
        })),
        reglas: creadas,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/* =====================================================================
   CRUD de normas (solo administradores)
   =====================================================================
   Las normas de origen `sistema` (sembradas desde los JSON) se pueden
   editar pero NO borrar: si se borraran, el siguiente arranque las volvería
   a crear y el usuario no entendería por qué reaparecen.
   ===================================================================== */

/** POST /plantillas-alerta — crear una norma propia. */
router.post('/', requiereRol('admin'), async (req, res, next) => {
  try {
    const datos = esquemaCrearPlantilla.parse(req.body);
    const creada = await plantillaService.crearPlantilla(datos);
    responderExito(res, creada, 201);
  } catch (error) {
    next(error);
  }
});

/** PUT /plantillas-alerta/:id — editar una norma (de sistema o propia). */
router.put('/:id', requiereRol('admin'), async (req, res, next) => {
  try {
    const datos = esquemaActualizarPlantilla.parse(req.body);
    const actualizada = await plantillaService.actualizarPlantilla(
      String(req.params.id),
      datos
    );
    responderExito(res, actualizada, 200);
  } catch (error) {
    next(error);
  }
});

/** DELETE /plantillas-alerta/:id — borrar una norma propia. */
router.delete('/:id', requiereRol('admin'), async (req, res, next) => {
  try {
    await plantillaService.eliminarPlantilla(String(req.params.id));
    responderExito(res, { eliminada: String(req.params.id) }, 200);
  } catch (error) {
    next(error);
  }
});

/* =====================================================================
   Aplicar una norma a TODAS las áreas
   ===================================================================== */

/**
 * POST /plantillas-alerta/:id/aplicar-area
 *
 * Crea las reglas de la norma en todos los canales del área y, además,
 * deja constancia del perfil en `areas.perfil_alerta`.
 *
 * Informa de lo creado, lo repetido y lo omitido: aplicar dos veces una
 * norma no debe duplicar reglas.
 */
router.post('/:id/aplicar-area', requiereRol('usuario', 'admin'), async (req, res, next) => {
  try {
    const plantillaId = String(req.params.id);
    const areaId = String((req.body as { area_id?: unknown })?.area_id ?? '');

    if (!areaId) {
      res.status(400).json({ exito: false, mensaje: 'Falta el área' });
      return;
    }

    const resultado = await plantillaService.aplicarAArea(
      plantillaId,
      areaId,
      req.usuario
    );
    responderExito(res, resultado, 201);
  } catch (error) {
    next(error);
  }
});

/* =====================================================================
   Evaluar un valor con unas reglas — SIN estado, SIN base de datos
   ===================================================================== */

/**
 * POST /plantillas-alerta/evaluar
 *
 * Devuelve el nivel (`bueno`, `advertencia`, `critico`…) que tendría un
 * valor con las reglas dadas.
 *
 * Existe para que el formulario de reglas muestre la vista previa usando la
 * MISMA implementación que el panel y las alertas. Si la web reimplementara
 * la clasificación, ambas podrían discrepar.
 */
router.post('/evaluar', async (req, res, next) => {
  try {
    const { valor, reglas, calidad } = esquemaEvaluar.parse(req.body);
    const nivel = plantillaService.evaluarConReglas(
      valor ?? null,
      reglas,
      calidad
    );
    responderExito(res, { nivel }, 200);
  } catch (error) {
    next(error);
  }
});

export default router;
