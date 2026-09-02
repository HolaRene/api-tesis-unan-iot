import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { middlewareErrores } from './middlewares/error.middleware.js';
import { middlewareNoEncontrado } from './middlewares/not-found.middleware.js';

// Rutas de los distintos módulos
import healthRoutes from './modules/health/health.routes.js';
import userRoutes from './modules/users/user.routes.js';
import areaRoutes from './modules/areas/area.routes.js';
import deviceRoutes from './modules/devices/device.routes.js';
import variableTypeRoutes from './modules/variable-types/variable-type.routes.js';
import sensorRoutes from './modules/sensors/sensor.routes.js';
import measurementRoutes from './modules/measurements/measurement.routes.js';
import thresholdRoutes from './modules/thresholds/threshold.routes.js';
import alertRoutes from './modules/alerts/alert.routes.js';
import cameraRoutes from './modules/cameras/camera.routes.js';
import integrationRoutes from './modules/integrations/integration.routes.js';

/**
 * Crea y configura la aplicación Express con los middlewares globales
 * y el montaje de las rutas bajo /api/v1.
 */
export function crearApp(): Express {
  const app = express();

  // Prefijo común de todas las rutas de la API.
  const VERSION = '/api/v1';

  // --- Middlewares globales ---
  app.use(helmet()); // Cabeceras de seguridad HTTP
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  );
  app.use(express.json()); // Parser de JSON
  app.use(cookieParser(env.COOKIE_SECRET)); // Parser de cookies
  app.use(morgan('dev')); // Logging HTTP

  // Limitación de solicitudes por IP
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        exito: false,
        mensaje: 'Demasiadas solicitudes. Intente de nuevo más tarde.',
      },
    })
  );

  // --- Montaje de rutas ---
  app.use(VERSION, healthRoutes);
  app.use(`${VERSION}/users`, userRoutes);
  app.use(`${VERSION}/areas`, areaRoutes);
  app.use(`${VERSION}/devices`, deviceRoutes);
  app.use(`${VERSION}/variable-types`, variableTypeRoutes);
  app.use(`${VERSION}/sensors`, sensorRoutes);
  app.use(`${VERSION}/measurements`, measurementRoutes);
  app.use(`${VERSION}/thresholds`, thresholdRoutes);
  app.use(`${VERSION}/alerts`, alertRoutes);
  app.use(`${VERSION}/cameras`, cameraRoutes);
  app.use(`${VERSION}/integrations`, integrationRoutes);

  // 404 para rutas no encontradas
  app.use(middlewareNoEncontrado);

  // Manejo de errores (siempre al final)
  app.use(middlewareErrores);

  return app;
}
