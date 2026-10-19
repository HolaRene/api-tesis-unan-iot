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
const reglaPlantillaSchema = z.object({
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

export type PlantillaAlerta = z.infer<typeof plantillaSchema>;
export type ReglaPlantilla = z.infer<typeof reglaPlantillaSchema>;

/**
 * Lee y valida todos los archivos de plantilla.
 *
 * Se leen en cada llamada (son archivos pequeños): así editar un JSON y
 * reiniciar basta, sin caché que se quede obsoleta durante el desarrollo.
 */
export async function listarPlantillas(): Promise<PlantillaAlerta[]> {
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

/** Busca una plantilla por su id. */
export async function obtenerPlantilla(id: string): Promise<PlantillaAlerta> {
  const todas = await listarPlantillas();
  const encontrada = todas.find((p) => p.id === id);
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
