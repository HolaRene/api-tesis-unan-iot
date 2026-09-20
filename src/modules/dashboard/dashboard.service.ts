import { dashboardRepository } from './dashboard.repository.js';
import type { ResumenDashboard } from './dashboard.types.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del dashboard/resumen.
 *
 * AISLAMIENTO: el resumen se calcula solo sobre los recursos visibles para el
 * usuario (admin ve todo).
 */
export const dashboardService = {
  /** Devuelve el resumen para el dashboard, filtrado por usuario. */
  async obtenerResumen(
    limiteMediciones = 10,
    limiteAlertas = 10,
    usuario?: UsuarioAlcance | null
  ): Promise<ResumenDashboard> {
    return dashboardRepository.resumen(limiteMediciones, limiteAlertas, usuario);
  },
};
