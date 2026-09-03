# API de Monitoreo IoT/Industrial

API REST genérica construida con **Node.js + TypeScript + Express 5** para sistemas de monitoreo, telemetría e integración IoT/industrial.

El modelo es genérico y reutilizable en distintos dominios (ambiental, agrícola, industrial, edificios inteligentes, laboratorios, etc.). Está preparada para que **Node-RED** envíe mediciones vía HTTP/REST y para que una **plataforma web** consulte áreas, dispositivos, sensores, mediciones, alertas e integraciones.

---

## Contenido

- [Tecnologías](#tecnologías)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha](#puesta-en-marcha)
- [Configuración de entorno](#configuración-de-entorno)
- [Scripts](#scripts)
- [Estructura](#estructura)
- [Base de datos](#base-de-datos)
- [Autenticación](#autenticación-jwt)
- [Endpoints de la API](#endpoints-de-la-api)
- [Formato de respuestas](#formato-de-respuestas)
- [Validación automática de umbrales](#validación-automática-de-umbrales)
- [Ejemplos de uso con curl](#ejemplos-de-uso-con-curl)
- [Arquitectura](#arquitectura)
- [Buenas prácticas del código](#buenas-prácticas-del-código)

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| Node.js + TypeScript | Runtime y lenguaje principal (ES Modules) |
| Express 5 | Framework HTTP y API REST |
| PostgreSQL + pg | Base de datos relacional (**sin ORM**) |
| Zod | Validación de esquemas y variables de entorno |
| bcryptjs | Hash de contraseñas |
| jsonwebtoken | Autenticación JWT |
| cookie-parser | Manejo de cookies |
| Helmet | Cabeceras de seguridad HTTP |
| express-rate-limit | Limitación de solicitudes |
| cors | Política de orígenes |
| morgan | Logging HTTP |
| dotenv | Variables de entorno |
| tsx | Ejecución/recarga en desarrollo |
| pnpm | Gestor de paquetes |

## Requisitos previos

- **Node.js** >= 20
- **pnpm** >= 10
- **PostgreSQL** instalado y accesible localmente

## Puesta en marcha

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar entorno
cp .env.example .env.development

# 3. Aplicar migraciones (crea las tablas)
pnpm migrate

# 4. Crear usuario administrador
pnpm seed

# 5. Arrancar en desarrollo (recarga automática con tsx)
pnpm dev
```

El servidor escucha por defecto en `http://localhost:3000`. El puerto se configura con la variable `PORT` en el entorno (ej. `PORT=4000`).

### Producción

```bash
pnpm build
pnpm start
```

## Configuración de entorno

La API centraliza y valida todas las variables de entorno con **Zod** en `src/config/env.ts`. Si falta una variable obligatoria o su valor no es válido, la aplicación no arranca (evita errores silenciosos).

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto del servidor | `3000` |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) | `http://localhost:3000,http://localhost:5173` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://postgres:clave@localhost:5432/postgres` |
| `DB_POOL_MAX` | Máximo de conexiones del pool | `10` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | `cambia-este-secreto` |
| `JWT_EXPIRES_IN` | Expiración del token (ej: `15m`, `7d`) | `7d` |
| `COOKIE_SECRET` | Secreto de cookies | `mi-secreto` |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit (ms) | `900000` |
| `RATE_LIMIT_MAX` | Máx. solicitudes por ventana/IP | `100` |

> La API carga `.env.<NODE_ENV>` (ej. `.env.development`) si existe, o `.env` en su defecto.

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Arranca el servidor en desarrollo con recarga automática (`tsx watch`) |
| `pnpm check` | Validación de tipos de TypeScript (sin emitir) |
| `pnpm build` | Compila el proyecto a `dist/` |
| `pnpm start` | Ejecuta el servidor compilado desde `dist/` |
| `pnpm migrate` | Aplica las migraciones SQL de `src/database/migrations` |
| `pnpm seed` | Crea el usuario administrador inicial |

## Estructura

```
src/
├── config/            # Variables de entorno centralizadas (Zod)
├── database/
│   ├── migrations/    # SQL puro (esquema + cascade)
│   ├── seeds/         # Sembrados de datos
│   └── pool.ts        # Pool de conexiones PostgreSQL
├── modules/           # Módulos por entidad (routes/controller/service/repository/schema/types)
├── middlewares/       # auth (JWT), error, not-found
├── schemas/           # Esquemas compartidos (paginación, etc.)
├── utils/             # api-error, api-response
├── types/             # Extensiones de tipos (express.d.ts)
├── app.ts             # Configuración de la app Express y montaje de rutas
└── server.ts          # Punto de entrada y apagado controlado
```

Cada módulo sigue una separación clara de responsabilidades, por ejemplo `sensors`:

```
src/modules/sensors/
├── sensor.routes.ts      # Definición de rutas HTTP
├── sensor.controller.ts  # Manejo de request/response
├── sensor.service.ts     # Lógica de negocio y validaciones
├── sensor.repository.ts  # Consultas SQL a PostgreSQL
├── sensor.schema.ts      # Esquemas Zod de entrada
└── sensor.types.ts       # Tipos TypeScript de la entidad
```

## Base de datos

Todas las tablas y columnas están en **español** (snake_case).

| Módulo (carpeta en inglés) | Tabla en español |
|---|---|
| `users` | `usuarios` |
| `areas` | `areas` |
| `devices` | `dispositivos` |
| `variable-types` | `tipos_variable` |
| `sensors` | `sensores` |
| `measurements` | `mediciones` |
| `thresholds` | `umbrales` |
| `alerts` | `alertas` |
| `cameras` | `camaras` |
| `integrations` | `integraciones` |

> Nota: las carpetas de módulos conservan su nombre en inglés (estándar de código), pero las tablas/columnas son en español.

### Migraciones

Las migraciones son archivos `.sql` en `src/database/migrations/` y se aplican en orden:

```bash
pnpm migrate
```

- `0001_inicial.sql` — marcador de arranque.
- `0002_schema_entidades.sql` — esquema completo de las 10 tablas.
- `0003_cascade.sql` — claves foráneas con `ON DELETE CASCADE`.

### Eliminación en cascada

Al borrar un registro padre se eliminan automáticamente sus dependencias:

- Borrar un **sensor** elimina sus mediciones, umbrales y alertas.
- Borrar un **dispositivo** elimina sus sensores (y en cascada) + cámaras + integraciones.
- Borrar un **área** elimina sus dispositivos (y todo lo anterior en cadena).

> Se mantiene `NO ACTION` en `sensores.tipo_variable_id` para evitar borrar un tipo de variable que aún esté en uso.

## Autenticación (JWT)

La mayoría de rutas requieren un token. Se envía en el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| `POST` | `/api/v1/users/registro` | Registra un usuario (siempre `viewer`) | Público |
| `POST` | `/api/v1/users/login` | Inicia sesión y devuelve token | Público |
| `GET` | `/api/v1/users/perfil` | Perfil del usuario autenticado | Cualquier rol |
| `POST` | `/api/v1/users` | Crea un usuario con rol asignado (invitación) | Sólo admin |
| `GET` | `/api/v1/users` | Lista usuarios | Sólo admin |
| `GET` | `/api/v1/users/:id` | Obtiene un usuario | Sólo admin |
| `PATCH` | `/api/v1/users/:id` | Actualiza un usuario / cambia rol | Sólo admin |
| `DELETE` | `/api/v1/users/:id` | Elimina un usuario | Sólo admin |

### Roles y permisos

Roles: `viewer`, `usuario`, `admin`.

| Acción | `viewer` | `usuario` | `admin` |
|---|---|---|---|
| Leer (GET de cualquier módulo) | ✅ | ✅ | ✅ |
| Crear / Editar / Eliminar (monitoreo) | ❌ | ✅ | ✅ |
| Gestionar usuarios (roles, eliminar) | ❌ | ❌ | ✅ |

> El **registro público** (`POST /users/registro`) siempre crea el usuario con rol `viewer`, aunque se intente enviar otro rol en el body. Para asignar roles superiores un `admin` crea el usuario (POST `/users`) o lo actualiza (PATCH `/users/:id`).

## Endpoints de la API

> Todas las rutas van bajo el prefijo `/api/v1`. Las rutas de monitoreo requieren autenticación.

### Salud

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica que la API y PostgreSQL estén operativos |

### Usuarios

| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| `POST` | `/users/registro` | Registra un usuario (siempre `viewer`) | Público |
| `POST` | `/users/login` | Inicia sesión | Público |
| `GET` | `/users/perfil` | Perfil del token | Cualquier rol |
| `POST` | `/users` | Crea un usuario con rol asignado | Admin |
| `GET` | `/users` | Lista usuarios | Admin |
| `GET` | `/users/:id` | Obtiene usuario | Admin |
| `PATCH` | `/users/:id` | Actualiza usuario / cambia rol | Admin |
| `DELETE` | `/users/:id` | Elimina usuario | Admin |

> En los módulos de monitoreo (áreas, dispositivos, etc.), el campo "Rol" de las tablas siguientes indica: **GET** cualquier rol autenticado; **POST/PATCH/DELETE** solo `usuario` o `admin`.

### Áreas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/areas` | Lista áreas |
| `GET` | `/areas/:id` | Obtiene un área |
| `POST` | `/areas` | Crea un área |
| `PATCH` | `/areas/:id` | Actualiza un área |
| `DELETE` | `/areas/:id` | Elimina un área |

Campos: `nombre`, `tipo`, `descripcion`, `ubicacion`, `activo`.

### Dispositivos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/devices` | Lista dispositivos |
| `GET` | `/devices/:id` | Obtiene un dispositivo |
| `POST` | `/devices` | Crea un dispositivo |
| `PATCH` | `/devices/:id` | Actualiza un dispositivo |
| `DELETE` | `/devices/:id` | Elimina un dispositivo |

Campos: `area_id`, `nombre`, `tipo`, `fabricante`, `modelo`, `identificador`, `protocolo`, `direccion_ip`, `estado`, `metadatos`.

### Tipos de variable

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/variable-types` | Lista tipos de variable |
| `GET` | `/variable-types/:id` | Obtiene un tipo |
| `POST` | `/variable-types` | Crea un tipo |
| `PATCH` | `/variable-types/:id` | Actualiza un tipo |
| `DELETE` | `/variable-types/:id` | Elimina un tipo |

Campos: `codigo` (único), `nombre`, `descripcion`, `tipo_dato`, `unidad_default`.

### Sensores

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/sensors` | Lista sensores |
| `GET` | `/sensors/:id` | Obtiene un sensor |
| `POST` | `/sensors` | Crea un sensor |
| `PATCH` | `/sensors/:id` | Actualiza un sensor |
| `DELETE` | `/sensors/:id` | Elimina un sensor |

Campos: `dispositivo_id`, `tipo_variable_id`, `nombre`, `codigo` (único), `fabricante`, `modelo`, `unidad`, `rango_min`, `rango_max`, `precision`, `activo`, `configuracion`.

### Mediciones (ingesta para Node-RED)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/measurements` | **Ingesta** de medición (Node-RED / emisores) |
| `GET` | `/measurements?sensor_id=&limite=` | Lista mediciones (filtro opcional) |
| `GET` | `/measurements/:id` | Obtiene una medición |
| `DELETE` | `/measurements/:id` | Elimina una medición |

La ingesta acepta cualquiera de los valores según el tipo del sensor (debe enviarse al menos uno):

- `valor_numerico` (número)
- `valor_texto` (texto)
- `valor_booleano` (booleano)
- `valor_json` (objeto/json)

Opcionales: `calidad` (default `good`), `registrado_en` (default `NOW()`), `metadatos`.

### Umbrales

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/thresholds` | Lista umbrales |
| `GET` | `/thresholds/:id` | Obtiene un umbral |
| `POST` | `/thresholds` | Crea un umbral |
| `PATCH` | `/thresholds/:id` | Actualiza un umbral |
| `DELETE` | `/thresholds/:id` | Elimina un umbral |

Campos: `sensor_id`, `valor_min`, `valor_max`, `severidad`, `activo`.

### Alertas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/alerts` | Lista alertas |
| `GET` | `/alerts/:id` | Obtiene una alerta |
| `POST` | `/alerts` | Crea una alerta |
| `PATCH` | `/alerts/:id` | Actualiza una alerta |
| `DELETE` | `/alerts/:id` | Elimina una alerta |

Campos: `sensor_id`, `medicion_id`, `tipo`, `severidad`, `mensaje`, `estado` (`active`/`acknowledged`/`resolved`), timestamps, `metadatos`.

### Cámaras

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/cameras` | Lista cámaras |
| `GET` | `/cameras/:id` | Obtiene una cámara |
| `POST` | `/cameras` | Crea una cámara |
| `PATCH` | `/cameras/:id` | Actualiza una cámara |
| `DELETE` | `/cameras/:id` | Elimina una cámara |

Campos: `dispositivo_id`, `protocolo`, `ruta_stream`, `grabacion_habilitada`, `configuracion`.

### Integraciones

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/integrations` | Lista integraciones |
| `GET` | `/integrations/:id` | Obtiene una integración |
| `POST` | `/integrations` | Crea una integración |
| `PATCH` | `/integrations/:id` | Actualiza una integración |
| `DELETE` | `/integrations/:id` | Elimina una integración |

Campos: `dispositivo_id`, `plataforma`, `tipo`, `id_externo`, `activo`, `configuracion`.

## Formato de respuestas

Toda respuesta sigue una forma estándar:

**Éxito**

```json
{
  "exito": true,
  "mensaje": "Opcional",
  "datos": { ... }
}
```

**Error**

```json
{
  "exito": false,
  "mensaje": "Descripción del error",
  "detalles": "Opcional"
}
```

Códigos de estado usados: `200` OK, `201` creado, `400` solicitud inválida/validación, `401` no autenticado, `403` prohibido, `404` no encontrado, `409` conflicto (duplicado), `501` no implementado, `503` servicio no disponible.

## Validación automática de umbrales

Al **ingerir una medición** (`POST /measurements`), el sistema evalúa automáticamente los **umbrales activos** del sensor:

- Si el `valor_numerico` es menor que `valor_min` o mayor que `valor_max`, se genera una **alerta automática** vinculada a la medición.
- La alerta lleva `tipo: "umbral"`, la `severidad` del umbral y un mensaje descriptivo.

Ejemplo: un umbral con `valor_min: 0` y `valor_max: 30`:

```bash
# Dentro del rango -> no genera alerta
POST /api/v1/measurements { "sensor_id": "...", "valor_numerico": 20 }

# Fuera del rango -> genera alerta automática
POST /api/v1/measurements { "sensor_id": "...", "valor_numerico": 45 }
```

## Ejemplos de uso con curl

### Iniciar sesión

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@monitoreo.local","password":"Admin12345"}' \
  | jq -r '.datos.token')
```

### Crear un dispositivo (con su área)

```bash
# Área
AREA=$(curl -s -X POST http://localhost:3000/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Quirófano 1","tipo":"quirófano"}')

ID_AREA=$(echo "$AREA" | jq -r '.datos.id')

# Dispositivo
curl -s -X POST http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"area_id\":\"$ID_AREA\",\"nombre\":\"Gateway 01\",\"tipo\":\"gateway\"}"
```

### Ingerir una medición (Node-RED)

```bash
curl -s -X POST http://localhost:3000/api/v1/measurements \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sensor_id":"<UUID-del-sensor>","valor_numerico":23.5,"calidad":"good"}'
```

### Listar mediciones de un sensor

```bash
curl -s "http://localhost:3000/api/v1/measurements?sensor_id=<UUID>&limite=50" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Arquitectura

```text
Node-RED / Plataforma web / Integraciones
                  │
                  ▼
              Express 5
                  │
                  ▼
                 Zod
                  │
                  ▼
             Controllers   →  HTTP / request / response
                  │
                  ▼
              Services     →  lógica de negocio
                  │
                  ▼
            Repositories   →  consultas SQL / PostgreSQL
                  │
                  ▼
                 pg
                  │
                  ▼
             PostgreSQL
```

## Buenas prácticas del código

- **ES Modules** con imports tipados en TypeScript.
- **Separación de capas**: controller → service → repository, con SQL aislado en los repositorios.
- **Validación centralizada** de variables de entorno y datos de entrada con **Zod**.
- **Autenticación JWT** y protección de rutas por middleware.
- **Sin ORM**: todas las consultas usan `pg` directamente.
- **Respuestas estándar** con `exito`/`mensaje`/`datos` y gestión central de errores.
- **Pool reutilizable** de PostgreSQL en `src/database/pool.ts`.
- **Migraciones SQL puras** y borrado en cascada configurado en la base de datos.
