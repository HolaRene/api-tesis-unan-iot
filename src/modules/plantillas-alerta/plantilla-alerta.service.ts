/**
 * Plantillas de reglas de alerta por perfil de entorno.
 *
 * Cada perfil (quirófano, sala limpia, centro de datos, cadena de frío) es un
 * archivo JSON en esta carpeta. Añadir un perfil nuevo es añadir un archivo:
 * no requiere tocar código.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CÓMO SE APLICA UNA PLANTILLA
 * ──────────────────────────────────────────────────────────────────────
 * Una plantilla no se guarda como entidad propia: al aplicarla se crean
 * REGLAS NORMALES en `reglas_alerta`, vinculadas a un canal concreto. A
 * partir de ahí son reglas como cualquier otra y se pueden editar una a una.
 *
 * Eso es a propósito: las reglas aplicadas deben poder ajustarse sin quedar
 * «atadas» a la plantilla.
 *
 * ──────────────────────────────────────────────────────────────────────
 * VARIABLE vs TIPO DE VARIABLE
 * ──────────────────────────────────────────────────────────────────────
 * Cada regla de la plantilla declara:
 *
 *   - `variable`: nombre legible de la magnitud («temperatura»). Solo
 *     informativo.
 *   - `tipos_variable`: códigos del catálogo `tipos_variable` que encajan.
 *
 * Al aplicar la plantilla a un canal se comprueba que el tipo del canal esté
 * entre los aceptados. Si no, esa regla se omite y se informa: es mejor no
 * crear una regla de temperatura en un canal de presión que crearla mal.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { ApiError } from '../../utils/api-error.js';

/*
 * Los JSON viven en `src/plantillas-alerta/`, un nivel arriba de este módulo.
 *
 * Con `tsx` (desarrollo) `import.meta.url` apunta a `src/modules/...`, así que
 * se sube dos carpetas. IMPORTANTE: al compilar con `tsc` a `dist/`, los .json
 * NO se copian solos; el script de build debe hacerlo o el catálogo aparecerá
 * vacío en producción.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PLANTILLAS = path.resolve(__dirname, '../../plantillas-alerta');

/** Esquema de una regla dentro de una plantilla. */
export const reglaPlantillaSchema = z.object({
  variable: z.string().min(1),
  tipos_variable: z.array(z.string()).min(1),
  nombre: z.string().min(1).max(120),
  operador: z.string().min(1),
  valor_referencia_numerico: z.number().optional().nullable(),
  valor_min: z.number().optional().nullable(),
  valor_max: z.number().optional().nullable(),
  valor_referencia_texto: z.string().optional().nullable(),
  severidad: z.enum(['info', 'warning', 'critical']),
  retardo_segundos: z.number().int().nonnegative().optional().nullable(),
  histeresis: z.number().nonnegative().optional().nullable(),
  mensaje: z.string().optional().nullable(),
});

const plantillaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  norma: z.string().min(1),
  notas: z.array(z.string()).default([]),
  reglas: z.array(reglaPlantillaSchema).min(1),
});

import { plantillaRepository } from './plantilla-alerta.repository.js';
import { areaService } from '../areas/area.service.js';
import { canalService } from '../canales/canal.service.js';
import { reglaService } from '../reglas-alerta/regla-alerta.service.js';
import { clasificarNivel } from '../areas/cumplimiento.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

export type PlantillaAlerta = z.infer<typeof plantillaSchema>;
export type ReglaPlantilla = z.infer<typeof reglaPlantillaSchema>;

/**
 * Lee y valida los archivos JSON del repositorio.
 *
 * Ya NO son la fuente de lectura normal: se usan solo para SEMBRAR la tabla
 * `plantillas_alerta` al arrancar. Las normas se sirven desde la base para
 * que un administrador pueda crear y editar las suyas sin tocar código.
 */
export async function leerPlantillasDeArchivos(): Promise<PlantillaAlerta[]> {
  const archivos = (await readdir(DIR_PLANTILLAS)).filter((f) => f.endsWith('.json'));
  const plantillas: PlantillaAlerta[] = [];

  for (const archivo of archivos.sort()) {
    const crudo = await readFile(path.join(DIR_PLANTILLAS, archivo), 'utf8');
    let datos: unknown;
    try {
      datos = JSON.parse(crudo);
    } catch (e) {
      throw new Error(
        `Plantilla '${archivo}' no es JSON válido: ${e instanceof Error ? e.message : e}`
      );
    }

    const r = plantillaSchema.safeParse(datos);
    if (!r.success) {
      const detalle = r.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new Error(`Plantilla '${archivo}' inválida → ${detalle}`);
    }
    plantillas.push(r.data);
  }

  return plantillas;
}

/**
 * Copia las normas de los JSON a la base de datos.
 *
 * Idempotente: se ejecuta al arrancar la API. Solo actualiza las de origen
 * `sistema`, así que NO pisa las ediciones que haga un administrador sobre
 * una norma sembrada... salvo el nombre/norma del JSON, que se refresca.
 */
export async function sembrarPlantillasDesdeJson(): Promise<number> {
  const plantillas = await leerPlantillasDeArchivos();
  for (const p of plantillas) {
    await plantillaRepository.sembrar(p);
  }
  return plantillas.length;
}

/** Lista las normas (de sistema y propias). */
export async function listarPlantillas(): Promise<
  (PlantillaAlerta & { origen: string })[]
> {
  return plantillaRepository.listar();
}

/** Busca una norma por su id. */
export async function obtenerPlantilla(
  id: string
): Promise<PlantillaAlerta & { origen: string }> {
  const encontrada = await plantillaRepository.buscarPorId(id);
  if (!encontrada) {
    throw ApiError.notFound(`No existe la plantilla '${id}'`);
  }
  return encontrada;
}

/**
 * Filtra las reglas de una plantilla que aplican a un tipo de variable.
 *
 * Devuelve las que encajan y las que se omiten, para poder informarlas.
 */
export function reglasAplicables(
  plantilla: PlantillaAlerta,
  codigoTipoVariable: string | null | undefined
): { aplicables: ReglaPlantilla[]; omitidas: ReglaPlantilla[] } {
  const codigo = (codigoTipoVariable ?? '').toUpperCase();
  const aplicables: ReglaPlantilla[] = [];
  const omitidas: ReglaPlantilla[] = [];

  for (const regla of plantilla.reglas) {
    const encaja = regla.tipos_variable.some((t) => t.toUpperCase() === codigo);
    (encaja ? aplicables : omitidas).push(regla);
  }

  return { aplicables, omitidas };
}

/* =====================================================================
   CRUD de normas
   ===================================================================== */

/** Crea una norma propia (`origen = 'usuario'`). */
export async function crearPlantilla(datos: {
  id: string;
  nombre: string;
  descripcion?: string | null;
  norma: string;
  notas?: string[];
  reglas: ReglaPlantilla[];
}): Promise<PlantillaAlerta & { origen: string }> {
  if (await plantillaRepository.existe(datos.id)) {
    throw ApiError.conflict(
      `Ya existe una norma con el identificador '${datos.id}'`
    );
  }

  return plantillaRepository.crear({
    id: datos.id,
    nombre: datos.nombre,
    descripcion: datos.descripcion ?? null,
    norma: datos.norma,
    notas: datos.notas ?? [],
    reglas: datos.reglas,
  });
}

/** Edita una norma. Las de sistema se pueden editar, pero no borrar. */
export async function actualizarPlantilla(
  id: string,
  datos: {
    nombre?: string;
    descripcion?: string | null;
    norma?: string;
    notas?: string[];
    reglas?: ReglaPlantilla[];
  }
): Promise<PlantillaAlerta & { origen: string }> {
  const actualizada = await plantillaRepository.actualizar(id, datos);
  if (!actualizada) {
    throw ApiError.notFound(`No existe la norma '${id}'`);
  }
  return actualizada;
}

/**
 * Borra una norma propia.
 *
 * Las de sistema no se pueden borrar: el siguiente arranque las volvería a
 * sembrar desde el JSON y reaparecerían sin explicación.
 */
export async function eliminarPlantilla(id: string): Promise<void> {
  const existente = await plantillaRepository.buscarPorId(id);
  if (!existente) {
    throw ApiError.notFound(`No existe la norma '${id}'`);
  }
  if (existente.origen === 'sistema') {
    throw ApiError.badRequest(
      'Las normas de sistema no se pueden borrar. Puedes editarlas o desactivarlas.'
    );
  }

  const borrada = await plantillaRepository.eliminar(id);
  if (!borrada) {
    throw ApiError.badRequest(`No se pudo borrar la norma '${id}'`);
  }
}

/* =====================================================================
   Aplicar una norma a todas las áreas
   ===================================================================== */

/**
 * Aplica una norma a todos los canales de un área.
 *
 * Además de crear las reglas, guarda el id en `areas.perfil_alerta` para que
 * el área recuerde a qué norma se somete (lo usa la vista de cumplimiento).
 *
 * Evita duplicados: si un canal ya tiene una regla con el mismo nombre
 * procedente de la misma norma, no se vuelve a crear.
 */
export async function aplicarAArea(
  plantillaId: string,
  areaId: string,
  usuario?: UsuarioAlcance | null
): Promise<{
  plantilla: string;
  area_id: string;
  creadas: number;
  repetidas: number;
  omitidas: { canal: string; variable: string; motivo: string }[];
  canales: number;
}> {
  const plantilla = await obtenerPlantilla(plantillaId);

  // El área se busca con el alcance del usuario: aplica el aislamiento.
  const area = await areaService.obtenerPorId(areaId, usuario);

  const canales = await canalService.listar({ area_id: areaId }, usuario);

  let creadas = 0;
  let repetidas = 0;
  const omitidas: { canal: string; variable: string; motivo: string }[] = [];

  for (const canal of canales) {
    const { aplicables, omitidas: noEncajan } = reglasAplicables(
      plantilla,
      canal.tipo_codigo
    );

    for (const r of noEncajan) {
      omitidas.push({
        canal: canal.codigo,
        variable: r.variable,
        motivo: `Requiere un canal de tipo ${r.tipos_variable.join(' o ')} y este es ${canal.tipo_codigo ?? 'desconocido'}`,
      });
    }

    const existentes = await reglaService.listar({
      canal_id: canal.id,
      activa: true,
    });
    const nombresExistentes = new Set(
      existentes
        .filter((e) => e.plantilla_id === plantilla.id)
        .map((e) => e.nombre)
    );

    for (const regla of aplicables) {
      if (nombresExistentes.has(regla.nombre)) {
        repetidas += 1;
        continue;
      }

      await reglaService.crear({
        canal_id: canal.id,
        nombre: regla.nombre,
        descripcion: `Norma «${plantilla.nombre}» · variable: ${regla.variable}`,
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
        plantilla_id: plantilla.id,
        norma: plantilla.norma,
        requiere_verificacion: /\[verificar\]/i.test(regla.mensaje ?? ''),
      });
      creadas += 1;
    }
  }

  // Dejar constancia del perfil en el área.
  await areaService.actualizar(areaId, { perfil_alerta: plantilla.id }, usuario);

  return {
    plantilla: plantilla.id,
    area_id: area.id,
    creadas,
    repetidas,
    omitidas,
    canales: canales.length,
  };
}

/* =====================================================================
   Evaluación puntual (vista previa del formulario)
   ===================================================================== */

/**
 * Devuelve el nivel de un valor con unas reglas dadas.
 *
 * `calidad = 'bad'` devuelve `falla` sin mirar las reglas: un sensor
 * averiado no tiene un valor que se pueda comparar con nada.
 *
 * ⚠️ Usa `clasificarNivel`, la MISMA función que el panel y las alertas.
 * Si la web reimplementara esto, ambas vistas podrían discrepar.
 */
export function evaluarConReglas(
  valor: number | null,
  reglas: ReglaPlantilla[],
  calidad?: string
): string {
  if ((calidad ?? 'good').toLowerCase() === 'bad') return 'falla';
  return clasificarNivel(valor, reglas);
}
