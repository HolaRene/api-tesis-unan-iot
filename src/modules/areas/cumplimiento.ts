/**
 * Cumplimiento normativo de un área.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ RESPONDE
 * ──────────────────────────────────────────────────────────────────────
 * «¿Se está cumpliendo la norma en este recinto ahora mismo?», magnitud por
 * magnitud, comparando el último valor medido con la banda que fija el
 * perfil del área.
 *
 *     Temperatura    23,4 °C   [20 – 24]   ✓ Cumple
 *     Humedad        68,0 %    [20 – 60]   ✗ Fuera
 *     Presión        —         [≥ 2,5]     ○ Sin datos
 *
 * ──────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALEN LAS BANDAS
 * ──────────────────────────────────────────────────────────────────────
 * Del perfil del área (`areas.perfil_alerta`), que referencia una de las
 * plantillas JSON. Se toman sus reglas de severidad `warning`: son las que
 * definen la banda ACEPTABLE. Las `critical` marcan el margen donde el
 * riesgo es grave, y no se usan para decidir «cumple o no».
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ ES UNA FUNCIÓN PURA
 * ──────────────────────────────────────────────────────────────────────
 * El cálculo de «dentro / fuera / sin datos» no toca la base: recibe los
 * valores ya reunidos. Así se puede probar cada caso límite sin levantar la
 * aplicación, y el significado de «cumple» queda en un solo sitio.
 */
import type { ReglaPlantilla, PlantillaAlerta } from '../plantillas-alerta/plantilla-alerta.service.js';

export type EstadoCumplimiento = 'cumple' | 'fuera' | 'sin_datos' | 'sin_regla';

export interface CumplimientoMagnitud {
  /** Código del tipo de variable, p. ej. TEMPERATURA. */
  tipo_codigo: string;
  tipo_nombre: string;
  unidad: string | null;
  /** Último valor medido, si lo hay. */
  valor: number | null;
  /** Cuándo se midió ese valor. */
  medido_en: Date | null;
  estado: EstadoCumplimiento;
  /** Banda aceptable del perfil, en texto («20 – 24», «> 10»…). */
  banda: string | null;
  /** Límites numéricos, para pintar la escala. */
  minimo: number | null;
  maximo: number | null;
  /** La magnitud tiene reglas en el perfil del área. */
  cubierta: boolean;
  /** Alguno de sus valores está marcado [verificar]. */
  requiere_verificacion: boolean;
}

/**
 * Convierte una regla de la plantilla en una banda legible.
 *
 * Se usa `fuera_de_rango` como banda cerrada y las comparaciones simples
 * (`>`, `<`) como límites abiertos.
 */
export function describirBanda(regla: ReglaPlantilla): {
  texto: string;
  minimo: number | null;
  maximo: number | null;
} {
  const u = '';

  switch (regla.operador) {
    case 'fuera_de_rango':
    case 'entre':
      return {
        texto: `${regla.valor_min ?? '…'}${u} – ${regla.valor_max ?? '…'}${u}`,
        minimo: regla.valor_min ?? null,
        maximo: regla.valor_max ?? null,
      };
    case '>':
      return {
        texto: `> ${regla.valor_referencia_numerico ?? '…'}${u}`,
        minimo: regla.valor_referencia_numerico ?? null,
        maximo: null,
      };
    case '>=':
      return {
        texto: `≥ ${regla.valor_referencia_numerico ?? '…'}${u}`,
        minimo: regla.valor_referencia_numerico ?? null,
        maximo: null,
      };
    case '<':
      return {
        texto: `< ${regla.valor_referencia_numerico ?? '…'}${u}`,
        minimo: null,
        maximo: regla.valor_referencia_numerico ?? null,
      };
    case '<=':
      return {
        texto: `≤ ${regla.valor_referencia_numerico ?? '…'}${u}`,
        minimo: null,
        maximo: regla.valor_referencia_numerico ?? null,
      };
    default:
      return { texto: regla.operador, minimo: null, maximo: null };
  }
}

/**
 * ¿El valor está dentro de la banda aceptable?
 *
 * Para un límite abierto (`> 10`), se cumple si el valor supera el mínimo.
 * Para una banda cerrada (`20–24`), si está entre ambos inclusive.
 */
export function dentroDeBanda(
  valor: number,
  minimo: number | null,
  maximo: number | null
): boolean {
  if (minimo !== null && valor < minimo) return false;
  if (maximo !== null && valor > maximo) return false;
  return true;
}

/** Reglas de una plantilla que aplican a un tipo de variable. */
function reglasDeTipo(
  plantilla: PlantillaAlerta,
  tipoCodigo: string
): ReglaPlantilla[] {
  const codigo = tipoCodigo.toUpperCase();
  return plantilla.reglas.filter((r) =>
    r.tipos_variable.some((t) => t.toUpperCase() === codigo)
  );
}

/**
 * Construye el cumplimiento de cada magnitud del área.
 *
 * @param plantilla    Perfil del área, o null si no tiene ninguno declarado.
 * @param magnitudes   Tipos de variable presentes en el área.
 * @param ultimos      Último valor por tipo de variable.
 */
export function calcularCumplimiento(
  plantilla: PlantillaAlerta | null,
  magnitudes: { codigo: string; nombre: string; unidad: string | null }[],
  ultimos: Map<string, { valor: number | null; medido_en: Date | null }>
): CumplimientoMagnitud[] {
  return magnitudes.map((mag) => {
    const ultimo = ultimos.get(mag.codigo.toUpperCase());
    const valor = ultimo?.valor ?? null;

    if (!plantilla) {
      return {
        tipo_codigo: mag.codigo,
        tipo_nombre: mag.nombre,
        unidad: mag.unidad,
        valor,
        medido_en: ultimo?.medido_en ?? null,
        estado: 'sin_regla',
        banda: null,
        minimo: null,
        maximo: null,
        cubierta: false,
        requiere_verificacion: false,
      };
    }

    const reglas = reglasDeTipo(plantilla, mag.codigo);

    /*
     * Se usa la regla de advertencia: define la banda ACEPTABLE.
     * Si solo hay crítica, se usa esa como referencia.
     */
    const reglaBanda =
      reglas.find((r) => r.severidad === 'warning') ?? reglas[0] ?? null;

    if (!reglaBanda) {
      return {
        tipo_codigo: mag.codigo,
        tipo_nombre: mag.nombre,
        unidad: mag.unidad,
        valor,
        medido_en: ultimo?.medido_en ?? null,
        estado: 'sin_regla',
        banda: null,
        minimo: null,
        maximo: null,
        cubierta: false,
        requiere_verificacion: false,
      };
    }

    const { texto, minimo, maximo } = describirBanda(reglaBanda);
    const requiereVerificacion = reglas.some((r) =>
      /\[verificar\]/i.test(r.mensaje ?? '')
    );

    let estado: EstadoCumplimiento;
    if (valor === null) estado = 'sin_datos';
    else estado = dentroDeBanda(valor, minimo, maximo) ? 'cumple' : 'fuera';

    return {
      tipo_codigo: mag.codigo,
      tipo_nombre: mag.nombre,
      unidad: mag.unidad,
      valor,
      medido_en: ultimo?.medido_en ?? null,
      estado,
      banda: texto,
      minimo,
      maximo,
      cubierta: true,
      requiere_verificacion: requiereVerificacion,
    };
  });
}
