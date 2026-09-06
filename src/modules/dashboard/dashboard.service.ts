import { dashboardRepository } from './dashboard.repository.js';
import type { ResumenDashboard } from './dashboard.types.js';

/**
 * Lógica de negocio del dashboard/resumen.
 */
export const dashboardService = {
  /** Devuelve el resumen para el dashboard. */
  async obtenerResumen(limiteMediciones = 10, limiteAlertas = 10): Promise<ResumenDashboard> {
    return dashboardRepository.resumen(limiteMediciones, limiteAlertas);
  },
};
