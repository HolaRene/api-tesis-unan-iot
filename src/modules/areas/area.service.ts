import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import { areaRepository } from './area.repository.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';
import {
  calcularCumplimiento,
  describirBanda,
} from './cumplimiento.js';
  // Ojo: el del módulo común es el que entiende la calidad.
  import { clasificarNivel } from '../reglas-alerta/nivel.js';
import type { ReglaPlantilla } from '../plantillas-alerta/plantilla-alerta.service.js';
import { listarPlantillas } from '../plantillas-alerta/plantilla-alerta.service.js';

/**
 * Lógica de negocio del módulo de áreas.
 * Orquesta validaciones y delegación al repositorio.
 *
 * AISLAMIENTO: todas las operaciones reciben el usuario autenticado. Un
 * `admin` ve y edita todo; el resto solo lo suyo (más lo global en lectura).
 */
export const areaService = {
  /** Lista las áreas visibles para el usuario. */
  async listar(usuario?: UsuarioAlcance | null): Promise<Area[]> {
    return areaRepository.listar(usuario);
  },

  /**
   * Obtiene un área por id.
   * Si existe pero no es visible para el usuario, responde 404 (no revela
   * que el recurso existe).
   */
  async obtenerPorId(id: string, usuario?: UsuarioAlcance | null): Promise<Area> {
    const area = await areaRepository.buscarPorId(id, usuario);
    if (!area) {
      throw ApiError.notFound('Área no encontrada');
    }
    return area;
  },

  /** Crea un área asignándole como propietario al usuario autenticado. */
  async crear(
    entrada: CrearAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area> {
    return areaRepository.crear({
      ...entrada,
      // Un admin puede crear recursos globales (sin dueño) si lo pide; el
      // resto siempre crea recursos propios.
      propietario_id: entrada.propietario_id ?? usuario?.id ?? null,
    });
  },

  /** Actualiza un área por id (solo el propietario o un admin). */
  async actualizar(
    id: string,
    entrada: ActualizarAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area> {
    const actualizada = await areaRepository.actualizar(id, entrada, usuario);
    if (!actualizada) {
      // Puede ser que no exista o que no tenga permiso: se comprueba para
      // responder 403 en lugar de 404 cuando el recurso sí existe.
      const existe = await areaRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para modificar esta área');
      }
      throw ApiError.notFound('Área no encontrada');
    }
    return actualizada;
  },

  /** Elimina un área por id (solo el propietario o un admin). */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const eliminada = await areaRepository.eliminar(id, usuario);
    if (!eliminada) {
      const existe = await areaRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para eliminar esta área');
      }
      throw ApiError.notFound('Área no encontrada');
    }
  },

  /**
   * Cumplimiento normativo del área.
   *
   * Devuelve, por cada magnitud presente, el último valor medido frente a la
   * banda que fija el perfil del área. Si el área no declara perfil, se
   * devuelve igualmente con estado `sin_regla` para que la interfaz pueda
   * ofrecer asignarlo.
   */
  async cumplimiento(id: string, usuario?: UsuarioAlcance | null) {
    const area = await this.obtenerPorId(id, usuario);

    const plantillaId = area.perfil_alerta ?? null;
    let plantilla = null;
    if (plantillaId) {
      const plantillas = await listarPlantillas();
      plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;
    }

    const magnitudes = await areaRepository.ultimosValoresConReglas(id);

    /*
     * LAS REGLAS DEL CANAL MANDAN.
     *
     * Si un canal tiene sus propias reglas activas, se clasifica con ellas:
     * alguien las ajustó a propósito para ESE sensor, y eso pesa más que la
     * banda general de la norma del recinto.
     *
     * Solo cuando el canal no tiene ninguna se recurre a la plantilla del
     * área. Se indica en `origen_reglas` para que la web pueda explicarlo.
     */
    /*
     * Las REGLAS DEL CANAL MANDAN sobre la norma del área: si alguien
     * ajustó la temperatura de ESTE sensor a 22–26 °C, se clasifica con
     * eso, no con la banda general del recinto. Solo los canales sin
     * reglas propias recurren a la plantilla del área.
     *
     * `origen_reglas` lo indica para que la web pueda explicarlo.
     */
    const clasificar = (m: (typeof magnitudes)[number]) => {
      const reglasCanal = m.reglas as ReglaPlantilla[];

      if (reglasCanal.length > 0) {
        /*
         * La calidad se pasa SIEMPRE: un sensor en falla (-32768) no tiene
         * un valor comparable con un umbral. Sin esto saldría «crítico»
         * (temperatura bajísima) cuando lo correcto es «falla de sensor».
         */
        const nivel = clasificarNivel(m.valor, reglasCanal, m.calidad);
        const banda = reglasCanal.find((r) => r.severidad === 'warning') ?? reglasCanal[0];
        const descrita = banda ? describirBanda(banda) : null;
        return {
          tipo_codigo: m.codigo,
          tipo_nombre: m.nombre,
          unidad: m.unidad,
          valor: m.valor,
          medido_en: m.medido_en,
          estado: m.valor === null ? 'sin_datos' : nivel === 'bueno' ? 'cumple' : 'fuera',
          nivel,
          banda: descrita?.texto ?? null,
          minimo: descrita?.minimo ?? null,
          maximo: descrita?.maximo ?? null,
          cubierta: true,
          requiere_verificacion: reglasCanal.some((r) => /\[verificar\]/i.test(r.mensaje ?? '')),
          origen_reglas: 'canal',
        };
      }

      // Sin reglas propias: se usa la norma del área.
      const resultado = calcularCumplimiento(
        plantilla,
        [{ codigo: m.codigo, nombre: m.nombre, unidad: m.unidad }],
        new Map([
          [
            m.codigo.toUpperCase(),
            { valor: m.valor, medido_en: m.medido_en },
          ],
        ]),
        'area'
      )[0];

      // Respaldo con la norma del área: la calidad manda igual.
      if ((m.calidad ?? 'good').toLowerCase() === 'bad') {
        resultado.nivel = 'falla';
        resultado.estado = 'fuera';
      }
      return resultado;
    };

    const comprometidas = magnitudes.map(clasificar);

    return {
      area: { id: area.id, nombre: area.nombre, perfil_alerta: plantillaId },
      perfil: plantilla
        ? {
            id: plantilla.id,
            nombre: plantilla.nombre,
            norma: plantilla.norma,
            notas: plantilla.notas,
          }
        : null,
      magnitudes: comprometidas,
      resumen: {
        total: comprometidas.length,
        cumple: comprometidas.filter((m) => m.estado === 'cumple').length,
        fuera: comprometidas.filter((m) => m.estado === 'fuera').length,
        bueno: comprometidas.filter((m) => m.nivel === 'bueno').length,
        advertencia: comprometidas.filter((m) => m.nivel === 'advertencia').length,
        critico: comprometidas.filter((m) => m.nivel === 'critico').length,
        falla: comprometidas.filter((m) => m.nivel === 'falla').length,
        sin_datos: comprometidas.filter((m) => m.estado === 'sin_datos').length,
        sin_regla: comprometidas.filter((m) => m.estado === 'sin_regla').length,
      },
    };
  },
};
