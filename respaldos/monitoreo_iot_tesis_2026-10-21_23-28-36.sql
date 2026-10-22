--
-- PostgreSQL database dump
--

\restrict rDSc4VjehMa3hHhZvvZGG523YJ6j7Yd26J1OkclhTfuUHyVwf8qPxMy6yiTgjrk

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migraciones_aplicadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migraciones_aplicadas (
    archivo character varying(255) NOT NULL,
    aplicada_en timestamp with time zone DEFAULT now() NOT NULL,
    duracion_ms integer
);


--
-- Name: actuadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actuadores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispositivo_id uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    estado_actual character varying(50),
    activo boolean DEFAULT true,
    configuracion jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp with time zone DEFAULT now(),
    topico_mqtt character varying(200),
    ultima_orden_en timestamp with time zone,
    protocolo character varying(30) DEFAULT 'mqtt'::character varying NOT NULL,
    CONSTRAINT actuadores_protocolo_check CHECK (((protocolo)::text = ANY ((ARRAY['modbus'::character varying, 'gpio'::character varying, 'mqtt'::character varying, 'http'::character varying])::text[])))
);


--
-- Name: COLUMN actuadores.configuracion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.actuadores.configuracion IS 'Direccionamiento según el protocolo. modbus: {tipo, direccion, unidad_id}. gpio: {pin, nivel_activo}. mqtt: {topico}. http: {url, metodo}.';


--
-- Name: COLUMN actuadores.topico_mqtt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.actuadores.topico_mqtt IS 'Tema MQTT al que Node-RED publica las órdenes de este actuador. Si es NULL, se deriva del código.';


--
-- Name: COLUMN actuadores.ultima_orden_en; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.actuadores.ultima_orden_en IS 'Momento del último cambio de estado confirmado por el dispositivo.';


--
-- Name: COLUMN actuadores.protocolo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.actuadores.protocolo IS 'Cómo se acciona: modbus (PLC), gpio (ESP32), mqtt (tema propio) o http (URL).';


--
-- Name: alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id uuid,
    medicion_id bigint,
    tipo character varying(50),
    severidad character varying(20),
    mensaje text,
    estado character varying(20) DEFAULT 'active'::character varying,
    iniciada_en timestamp with time zone DEFAULT now(),
    reconocida_en timestamp with time zone,
    finalizada_en timestamp with time zone,
    metadatos jsonb DEFAULT '{}'::jsonb,
    canal_id uuid,
    regla_id uuid,
    valor_disparador_numerico numeric,
    valor_disparador_texto text,
    valor_disparador_booleano boolean,
    reconocida_por uuid
);


--
-- Name: alertas_retardo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas_retardo (
    regla_id uuid NOT NULL,
    desde timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE alertas_retardo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alertas_retardo IS 'Cronómetro de las reglas cuya condición se está cumpliendo pero aún no alcanza el retardo para alarmar.';


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50),
    descripcion text,
    ubicacion character varying(255),
    activo boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now(),
    propietario_id uuid,
    perfil_alerta character varying(80)
);


--
-- Name: COLUMN areas.perfil_alerta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.areas.perfil_alerta IS 'Id de la plantilla de alertas aplicable al recinto (p. ej. quirofano-ashrae-170). NULL = sin perfil declarado.';


--
-- Name: camaras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.camaras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispositivo_id uuid,
    protocolo character varying(30),
    ruta_stream text,
    grabacion_habilitada boolean DEFAULT false,
    configuracion jsonb DEFAULT '{}'::jsonb,
    nombre character varying(120),
    descripcion text,
    area_id uuid,
    direccion_ip inet,
    puerto_rtsp integer DEFAULT 554,
    ruta_webrtc character varying(120),
    estado character varying(30) DEFAULT 'desconectada'::character varying NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    ultima_conexion timestamp with time zone,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    metadatos jsonb DEFAULT '{}'::jsonb NOT NULL,
    propietario_id uuid,
    CONSTRAINT camaras_estado_check CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying, 'conectada'::character varying, 'desconectada'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: canales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id uuid,
    tipo_variable_id uuid,
    codigo character varying(100) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    unidad character varying(30),
    rango_min numeric,
    rango_max numeric,
    precision_valor numeric,
    activo boolean DEFAULT true NOT NULL,
    configuracion jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claves_api; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claves_api (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    prefijo character varying(30) NOT NULL,
    hash_clave character varying(255) NOT NULL,
    activa boolean DEFAULT true,
    permisos jsonb DEFAULT '{}'::jsonb,
    ultimo_uso timestamp with time zone,
    expira_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: comandos_actuador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comandos_actuador (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actuador_id uuid NOT NULL,
    usuario_id uuid,
    clave_api_id uuid,
    comando character varying(100) NOT NULL,
    valor jsonb,
    estado character varying(30) DEFAULT 'pendiente'::character varying,
    creado_en timestamp with time zone DEFAULT now(),
    enviado_en timestamp with time zone,
    ejecutado_en timestamp with time zone,
    respuesta jsonb,
    metadatos jsonb DEFAULT '{}'::jsonb,
    recogido_en timestamp with time zone,
    confirmado_en timestamp with time zone
);


--
-- Name: COLUMN comandos_actuador.recogido_en; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandos_actuador.recogido_en IS 'Instante (UTC) en que Node-RED obtuvo el comando de /iot/comandos/pendientes.';


--
-- Name: COLUMN comandos_actuador.confirmado_en; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.comandos_actuador.confirmado_en IS 'Instante (UTC) en que Node-RED verificó por lectura de vuelta que el estado pedido se alcanzó.';


--
-- Name: dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    area_id uuid,
    nombre character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    fabricante character varying(100),
    modelo character varying(100),
    identificador character varying(100),
    protocolo character varying(50),
    direccion_ip inet,
    estado character varying(30) DEFAULT 'offline'::character varying,
    metadatos jsonb DEFAULT '{}'::jsonb,
    ultima_conexion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now(),
    propietario_id uuid
);


--
-- Name: integraciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integraciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispositivo_id uuid,
    plataforma character varying(50),
    tipo character varying(50),
    id_externo character varying(255),
    activo boolean DEFAULT true,
    configuracion jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: mediciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mediciones (
    id bigint NOT NULL,
    sensor_id uuid,
    valor_numerico double precision,
    valor_texto text,
    valor_booleano boolean,
    valor_json jsonb,
    calidad character varying(20) DEFAULT 'good'::character varying,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    metadatos jsonb DEFAULT '{}'::jsonb,
    canal_id uuid
);


--
-- Name: COLUMN mediciones.metadatos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mediciones.metadatos IS 'Incluye origen_en (ISO 8601 UTC): instante en que el PLC/Node-RED generó la lectura, para medir latencia extremo a extremo.';


--
-- Name: mediciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mediciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mediciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mediciones_id_seq OWNED BY public.mediciones.id;


--
-- Name: reglas_alerta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_alerta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canal_id uuid NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text,
    operador character varying(40) NOT NULL,
    valor_referencia_numerico numeric,
    valor_referencia_texto text,
    valor_referencia_booleano boolean,
    valor_min numeric,
    valor_max numeric,
    severidad character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    mensaje text,
    activa boolean DEFAULT true NOT NULL,
    retardo_segundos integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    histeresis numeric(12,4),
    plantilla_id character varying(80),
    norma character varying(200),
    requiere_verificacion boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN reglas_alerta.histeresis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_alerta.histeresis IS 'Margen para cerrar la alerta una vez el valor vuelve a la banda. NULL = sin margen (cierra en cuanto entra).';


--
-- Name: COLUMN reglas_alerta.plantilla_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_alerta.plantilla_id IS 'Plantilla de la que se creó la regla. NULL si se creó a mano.';


--
-- Name: COLUMN reglas_alerta.norma; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_alerta.norma IS 'Norma de referencia heredada de la plantilla.';


--
-- Name: COLUMN reglas_alerta.requiere_verificacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_alerta.requiere_verificacion IS 'El valor procede de una fuente sin confirmar y está marcado [verificar].';


--
-- Name: sensores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispositivo_id uuid,
    tipo_variable_id uuid,
    nombre character varying(100) NOT NULL,
    codigo character varying(100) NOT NULL,
    fabricante character varying(100),
    modelo character varying(100),
    unidad character varying(30),
    rango_min numeric,
    rango_max numeric,
    "precision" numeric,
    activo boolean DEFAULT true,
    configuracion jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: tipos_variable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_variable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    tipo_dato character varying(30) NOT NULL,
    unidad_default character varying(30),
    categoria character varying(60),
    permite_reglas boolean DEFAULT true NOT NULL
);


--
-- Name: umbrales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.umbrales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id uuid,
    valor_min numeric,
    valor_max numeric,
    severidad character varying(30),
    activo boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    hash_contra character varying(255) NOT NULL,
    rol character varying(30) DEFAULT 'viewer'::character varying,
    activo boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now()
);


--
-- Name: mediciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones ALTER COLUMN id SET DEFAULT nextval('public.mediciones_id_seq'::regclass);


--
-- Data for Name: _migraciones_aplicadas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._migraciones_aplicadas (archivo, aplicada_en, duracion_ms) FROM stdin;
\.


--
-- Data for Name: actuadores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.actuadores (id, dispositivo_id, nombre, codigo, tipo, estado_actual, activo, configuracion, creado_en, topico_mqtt, ultima_orden_en, protocolo) FROM stdin;
23b28853-e311-4d19-9edd-2baa6693f858	060d73a0-92dc-4329-8e69-f037e814098e	Led Panel	DIGITAL-OUT-LED-PANEL-2	digital_out	\N	t	{"pin": 2, "nivel_activo": 0}	2026-10-15 22:37:22.811536-06	\N	\N	gpio
88c417d4-c623-4a6d-843d-c54c465d6f23	060d73a0-92dc-4329-8e69-f037e814098e	Foco	DIGITAL-OUT-FOCO	digital_out	\N	t	{"tipo": "coil", "direccion": 1, "unidad_id": 1}	2026-10-15 22:58:43.302346-06	\N	\N	modbus
e6efdf45-731e-4a16-9c7e-3f88b1040ae0	7eab7e87-9eea-4af5-a7d1-ef137ac547f0	Extractor	MOTOR-EXTRACTOR-2	motor	\N	t	{"tipo": "coil", "direccion": 100, "unidad_id": 1, "latencia_s": 6}	2026-10-15 22:37:22.788118-06	\N	\N	modbus
\.


--
-- Data for Name: alertas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertas (id, sensor_id, medicion_id, tipo, severidad, mensaje, estado, iniciada_en, reconocida_en, finalizada_en, metadatos, canal_id, regla_id, valor_disparador_numerico, valor_disparador_texto, valor_disparador_booleano, reconocida_por) FROM stdin;
\.


--
-- Data for Name: alertas_retardo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertas_retardo (regla_id, desde) FROM stdin;
\.


--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.areas (id, nombre, tipo, descripcion, ubicacion, activo, creado_en, propietario_id, perfil_alerta) FROM stdin;
61f50f5a-617d-4d7c-836f-4d62f3cd3178	Quirófano 1	\N	\N	\N	t	2026-10-15 22:36:38.501473-06	cd003c8e-61bb-4109-ae18-7735c2a31622	\N
4070b8b7-f523-45b7-ba78-f7e1517bee07	Área principal	\N	\N	\N	t	2026-10-15 22:53:03.970242-06	e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f	quirofano-ashrae-170
\.


--
-- Data for Name: camaras; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.camaras (id, dispositivo_id, protocolo, ruta_stream, grabacion_habilitada, configuracion, nombre, descripcion, area_id, direccion_ip, puerto_rtsp, ruta_webrtc, estado, activa, ultima_conexion, actualizado_en, creado_en, metadatos, propietario_id) FROM stdin;
\.


--
-- Data for Name: canales; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.canales (id, sensor_id, tipo_variable_id, codigo, nombre, descripcion, unidad, rango_min, rango_max, precision_valor, activo, configuracion, creado_en, actualizado_en) FROM stdin;
4d617900-215e-4c9e-9334-da2a1406b4a7	c4806045-b4d1-446c-a6bf-d21f2583c7f5	2cfc6e18-484e-46a8-86e5-6308aab2a1ea	DHT-QUIROFANO-TEMPERATURA	DHT Quirófano · Temperatura	Canal generado automáticamente a partir de las magnitudes del sensor.	°C	\N	\N	\N	t	{}	2026-10-15 22:43:29.579694-06	2026-10-15 22:43:29.579694-06
f851e99b-b705-44d0-99fd-c94f7f6e54ad	c4806045-b4d1-446c-a6bf-d21f2583c7f5	1d3de6ac-147d-44b5-b9e5-6911d2465e0e	DHT-QUIROFANO-HUMEDAD_RELATIVA	DHT Quirófano · Humedad relativa	Canal generado automáticamente a partir de las magnitudes del sensor.	%	\N	\N	\N	t	{}	2026-10-15 22:43:29.584979-06	2026-10-15 22:43:29.584979-06
8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6	f4dbe06e-e7f4-4b98-8f83-7780a78d3162	2cfc6e18-484e-46a8-86e5-6308aab2a1ea	TEMP-01-TEMPERATURA	TEMP-01 · Temperatura	Canal generado automáticamente a partir de las magnitudes del sensor.	C	\N	\N	\N	t	{}	2026-10-15 22:53:35.481863-06	2026-10-15 22:53:35.481863-06
\.


--
-- Data for Name: claves_api; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.claves_api (id, usuario_id, nombre, prefijo, hash_clave, activa, permisos, ultimo_uso, expira_en, creado_en) FROM stdin;
067673ea-9004-402a-a6b8-803b113d4c79	cd003c8e-61bb-4109-ae18-7735c2a31622	PLC Quirofano	flx_JU9LiOlb	$2b$10$4Aumz2A04Xo1ds5M/LkNgukj5LQrS83B9pxlPr/x5YgJKPS1tsyH2	t	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	\N	\N	2026-10-15 22:37:53.561341-06
9e8fb33b-52da-4d02-a984-92a2576f664e	cd003c8e-61bb-4109-ae18-7735c2a31622	PLC Quirofano 2	flx_jmAytt40	$2b$10$awvCAbNkgZJ9X5sJ5jMbLuwAuT5fcOC9hMz/GiBMtrs0wqlmURSRS	t	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	\N	\N	2026-10-15 22:37:57.888831-06
4daf4d29-5167-45e8-a096-4b9915fc755f	cd003c8e-61bb-4109-ae18-7735c2a31622	Verif Dashboard	flx_HyAer6C9	$2b$10$r7slOCc9fw7slLisuBn1Eu29tpDEYv.SYOeSL0ZNa1Kes9uAs/Nc6	f	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	2026-10-17 14:02:07.397186-06	\N	2026-10-17 14:02:07.274282-06
8a40fe3a-fd2a-4f18-bf32-e3c34d181459	cd003c8e-61bb-4109-ae18-7735c2a31622	PLC Documentacion	flx_WTb0-agH	$2b$10$g8rXUZsk.gfhA.l7D1BcS.FwLYCabkMMQnql6t2ZtjBV3wyCPQSWS	f	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	2026-10-15 23:11:22.416044-06	\N	2026-10-15 23:11:22.257951-06
a5777d14-77ba-4e79-8ff4-6dfb674d7ffa	cd003c8e-61bb-4109-ae18-7735c2a31622	Verif Expiracion	flx_xAxOCc-H	$2b$10$mcOS6J3KQslU6fU.mcWQjeX4LSG5SFijTj60vu13W8fYj51.EplOq	f	{"comandos:enviar": true}	2026-10-17 14:26:08.930041-06	\N	2026-10-17 14:26:08.844215-06
fec3f9ac-47f0-401e-9cbd-2fc23eb36810	e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f	Node-red simulador	flx_6ATcYgwZ	$2b$10$5cp4h8oXZtiCECmxb8ntuOUwtyaYCl/xc7WQDDXvoQQ3zJvcE3W62	t	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	2026-10-17 14:51:38.032854-06	\N	2026-10-15 22:59:49.892757-06
a5f9d248-ac48-4005-8167-a392114951fc	cd003c8e-61bb-4109-ae18-7735c2a31622	PLC Prueba Dir	flx_KBiwsts0	$2b$10$ASFX/nWjtY7EpSy0QdKg0eZkKAIdoRvZj4DNnFb8j3RB8BMMNYKNC	t	{"comandos:enviar": true, "mediciones:crear": true, "estado:actualizar": true}	2026-10-15 22:44:08.402051-06	\N	2026-10-15 22:38:03.502684-06
625bd8f5-7a50-4c64-9196-936dce2ee131	cd003c8e-61bb-4109-ae18-7735c2a31622	Verif 2	flx_LZhJyKM9	$2b$10$LX/zG8SQuAULiJTvXeY6Fe8TRPhkcGj5x/yYe500R1NxkqDQ9WQM6	f	{"comandos:enviar": true}	2026-10-17 14:02:25.576576-06	\N	2026-10-17 14:02:25.467672-06
67e347ea-060c-43af-89dd-fd556ebdae0b	cd003c8e-61bb-4109-ae18-7735c2a31622	Prueba Falla	flx_creArUHn	$2b$10$M1GkjuqbUbxL/mW7dfX8wePgImspxcBEAFL4hEhTnhALTX4aAAxzi	f	{"mediciones:crear": true}	2026-10-21 22:33:07.11526-06	\N	2026-10-21 22:29:42.689912-06
632a2ede-e660-455d-97b8-4db91bffad18	cd003c8e-61bb-4109-ae18-7735c2a31622	Test Retardo	flx_9qd4Eiya	$2b$10$LltDJh6ztJQynJ013YtoDu5PV0c6Zed2jC21opBYP.h4QaOs2wqZe	f	{"mediciones:crear": true}	2026-10-18 22:19:29.638917-06	\N	2026-10-18 22:16:19.126759-06
\.


--
-- Data for Name: comandos_actuador; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comandos_actuador (id, actuador_id, usuario_id, clave_api_id, comando, valor, estado, creado_en, enviado_en, ejecutado_en, respuesta, metadatos, recogido_en, confirmado_en) FROM stdin;
\.


--
-- Data for Name: dispositivos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dispositivos (id, area_id, nombre, tipo, fabricante, modelo, identificador, protocolo, direccion_ip, estado, metadatos, ultima_conexion, creado_en, propietario_id) FROM stdin;
060d73a0-92dc-4329-8e69-f037e814098e	4070b8b7-f523-45b7-ba78-f7e1517bee07	PCL principal	PLC	\N	\N	PCL-PRINCIPAL	MODBUS TCP	\N	offline	{}	2026-10-17 14:51:38.04331-06	2026-10-15 22:52:29.828579-06	e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f
7eab7e87-9eea-4af5-a7d1-ef137ac547f0	61f50f5a-617d-4d7c-836f-4d62f3cd3178	PLC Quirófano	open-plc	\N	\N	PLC-QUIROFANO	\N	\N	offline	{}	2026-10-21 22:30:00.815087-06	2026-10-15 22:36:38.523356-06	cd003c8e-61bb-4109-ae18-7735c2a31622
\.


--
-- Data for Name: integraciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integraciones (id, dispositivo_id, plataforma, tipo, id_externo, activo, configuracion, creado_en) FROM stdin;
\.


--
-- Data for Name: mediciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mediciones (id, sensor_id, valor_numerico, valor_texto, valor_booleano, valor_json, calidad, registrado_en, metadatos, canal_id) FROM stdin;
1	\N	25	\N	\N	\N	good	2026-10-15 22:43:36.336-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
2	\N	25.7	\N	\N	\N	good	2026-10-15 22:43:37.599-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
3	\N	26	\N	\N	\N	good	2026-10-15 22:43:38.857-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
4	\N	25.8	\N	\N	\N	good	2026-10-15 22:43:40.099-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
5	\N	25.2	\N	\N	\N	good	2026-10-15 22:43:41.358-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
6	\N	25.5	\N	\N	\N	good	2026-10-15 22:43:48.362-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
7	\N	24.7	\N	\N	\N	good	2026-10-15 22:44:05.972-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
8	\N	58	\N	\N	\N	good	2026-10-15 22:44:05.976-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	f851e99b-b705-44d0-99fd-c94f7f6e54ad
9	\N	25.4	\N	\N	\N	good	2026-10-15 22:44:07.19-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
10	\N	56	\N	\N	\N	good	2026-10-15 22:44:07.196-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	f851e99b-b705-44d0-99fd-c94f7f6e54ad
11	\N	26.1	\N	\N	\N	good	2026-10-15 22:44:08.403-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
12	\N	54	\N	\N	\N	good	2026-10-15 22:44:08.408-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	f851e99b-b705-44d0-99fd-c94f7f6e54ad
13	\N	26.9	\N	\N	\N	good	2026-10-17 14:11:06.92-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:06.715Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
14	\N	26.8	\N	\N	\N	good	2026-10-17 14:11:11.908-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:11.715Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
15	\N	27	\N	\N	\N	good	2026-10-17 14:11:16.902-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:16.716Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
16	\N	27.3	\N	\N	\N	good	2026-10-17 14:11:21.909-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:21.717Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
17	\N	27.6	\N	\N	\N	good	2026-10-17 14:11:26.899-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:26.718Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
18	\N	27.9	\N	\N	\N	good	2026-10-17 14:11:31.907-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:31.719Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
19	\N	28.1	\N	\N	\N	good	2026-10-17 14:11:36.893-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:36.720Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
20	\N	28.8	\N	\N	\N	good	2026-10-17 14:11:41.925-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:41.721Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
21	\N	29.2	\N	\N	\N	good	2026-10-17 14:11:46.933-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:46.722Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
22	\N	29.8	\N	\N	\N	good	2026-10-17 14:11:51.915-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:51.723Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
23	\N	30.3	\N	\N	\N	good	2026-10-17 14:11:56.887-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:11:56.724Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
24	\N	30.5	\N	\N	\N	good	2026-10-17 14:12:01.913-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:01.725Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
25	\N	31.3	\N	\N	\N	good	2026-10-17 14:12:06.89-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:06.727Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
26	\N	31.3	\N	\N	\N	good	2026-10-17 14:12:11.912-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:11.727Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
27	\N	32.1	\N	\N	\N	good	2026-10-17 14:12:16.896-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:16.728Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
28	\N	32.2	\N	\N	\N	good	2026-10-17 14:12:21.916-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:21.730Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
29	\N	32.7	\N	\N	\N	good	2026-10-17 14:12:26.895-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:26.731Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
30	\N	32.8	\N	\N	\N	good	2026-10-17 14:12:31.915-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:31.731Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
31	\N	32.7	\N	\N	\N	good	2026-10-17 14:12:36.893-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:36.732Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
32	\N	33	\N	\N	\N	good	2026-10-17 14:12:41.938-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:41.734Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
33	\N	33.1	\N	\N	\N	good	2026-10-17 14:12:46.929-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:46.735Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
34	\N	32.9	\N	\N	\N	good	2026-10-17 14:12:51.901-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:51.735Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
35	\N	32.4	\N	\N	\N	good	2026-10-17 14:12:56.906-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:12:56.737Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
36	\N	32.5	\N	\N	\N	good	2026-10-17 14:13:01.915-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:01.737Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
38	\N	31.7	\N	\N	\N	good	2026-10-17 14:13:11.905-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:11.739Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
39	\N	31.5	\N	\N	\N	good	2026-10-17 14:13:16.904-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:16.740Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
45	\N	29	\N	\N	\N	good	2026-10-17 14:13:46.927-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:46.744Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
50	\N	27.3	\N	\N	\N	good	2026-10-17 14:14:11.932-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:11.749Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
51	\N	27.2	\N	\N	\N	good	2026-10-17 14:14:16.951-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:16.750Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
37	\N	32.2	\N	\N	\N	good	2026-10-17 14:13:06.917-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:06.739Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
40	\N	31.2	\N	\N	\N	good	2026-10-17 14:13:21.9-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:21.741Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
41	\N	30.5	\N	\N	\N	good	2026-10-17 14:13:26.942-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:26.742Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
42	\N	30.4	\N	\N	\N	good	2026-10-17 14:13:31.906-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:31.742Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
43	\N	29.6	\N	\N	\N	good	2026-10-17 14:13:36.942-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:36.743Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
44	\N	29.4	\N	\N	\N	good	2026-10-17 14:13:41.924-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:41.744Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
46	\N	28.6	\N	\N	\N	good	2026-10-17 14:13:51.926-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:51.746Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
47	\N	28.1	\N	\N	\N	good	2026-10-17 14:13:56.966-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:13:56.747Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
48	\N	27.7	\N	\N	\N	good	2026-10-17 14:14:01.955-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:01.747Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
49	\N	27.4	\N	\N	\N	good	2026-10-17 14:14:06.952-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:06.748Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
52	\N	26.8	\N	\N	\N	good	2026-10-17 14:14:21.931-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:21.751Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
53	\N	27.1	\N	\N	\N	good	2026-10-17 14:14:26.95-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:26.752Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
54	\N	27.1	\N	\N	\N	good	2026-10-17 14:14:31.956-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:31.752Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
55	\N	27.5	\N	\N	\N	good	2026-10-17 14:14:36.962-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:36.753Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
56	\N	27.7	\N	\N	\N	good	2026-10-17 14:14:41.944-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:41.754Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
57	\N	28	\N	\N	\N	good	2026-10-17 14:14:46.935-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:46.755Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
58	\N	28.3	\N	\N	\N	good	2026-10-17 14:14:51.941-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:51.756Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
59	\N	28.6	\N	\N	\N	good	2026-10-17 14:14:56.935-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:14:56.757Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
60	\N	28.7	\N	\N	\N	good	2026-10-17 14:15:01.949-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:01.758Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
61	\N	29.4	\N	\N	\N	good	2026-10-17 14:15:06.94-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:06.759Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
62	\N	30	\N	\N	\N	good	2026-10-17 14:15:11.973-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:11.761Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
63	\N	30.4	\N	\N	\N	good	2026-10-17 14:15:16.974-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:16.762Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
64	\N	30.8	\N	\N	\N	good	2026-10-17 14:15:21.942-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:21.764Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
65	\N	31.3	\N	\N	\N	good	2026-10-17 14:15:26.945-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:26.766Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
66	\N	31.4	\N	\N	\N	good	2026-10-17 14:15:31.951-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:31.768Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
67	\N	32.6	\N	\N	\N	good	2026-10-17 14:15:47.055-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:46.775Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
68	\N	33.1	\N	\N	\N	good	2026-10-17 14:15:51.971-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:51.776Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
69	\N	33.1	\N	\N	\N	good	2026-10-17 14:15:56.977-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:15:56.776Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
70	\N	33.2	\N	\N	\N	good	2026-10-17 14:16:01.967-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:01.777Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
71	\N	33.1	\N	\N	\N	good	2026-10-17 14:16:06.964-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:06.777Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
72	\N	33.3	\N	\N	\N	good	2026-10-17 14:16:11.967-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:11.777Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
73	\N	33	\N	\N	\N	good	2026-10-17 14:16:16.976-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:16.779Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
74	\N	32.7	\N	\N	\N	good	2026-10-17 14:16:21.968-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:21.780Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
75	\N	32.5	\N	\N	\N	good	2026-10-17 14:16:26.974-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:26.781Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
76	\N	32	\N	\N	\N	good	2026-10-17 14:16:31.974-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:31.782Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
79	\N	31.1	\N	\N	\N	good	2026-10-17 14:16:46.952-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:46.786Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
82	\N	29.4	\N	\N	\N	good	2026-10-17 14:17:01.953-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:01.789Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
85	\N	28.5	\N	\N	\N	good	2026-10-17 14:17:16.954-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:16.794Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
88	\N	27.5	\N	\N	\N	good	2026-10-17 14:17:31.959-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:31.797Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
91	\N	27.1	\N	\N	\N	good	2026-10-17 14:17:46.965-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:46.799Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
94	\N	27.4	\N	\N	\N	good	2026-10-17 14:18:01.97-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:01.801Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
98	\N	29.1	\N	\N	\N	good	2026-10-17 14:18:21.898-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:21.805Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
102	\N	30.9	\N	\N	\N	good	2026-10-17 14:18:41.97-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:41.807Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
105	\N	31.8	\N	\N	\N	good	2026-10-17 14:18:56.973-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:56.810Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
109	\N	33	\N	\N	\N	good	2026-10-17 14:19:16.987-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:16.813Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
77	\N	31.8	\N	\N	\N	good	2026-10-17 14:16:36.978-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:36.783Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
78	\N	31.3	\N	\N	\N	good	2026-10-17 14:16:41.947-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:41.784Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
80	\N	30.7	\N	\N	\N	good	2026-10-17 14:16:51.951-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:51.788Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
81	\N	30.1	\N	\N	\N	good	2026-10-17 14:16:56.954-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:16:56.789Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
83	\N	29.2	\N	\N	\N	good	2026-10-17 14:17:06.952-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:06.791Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
84	\N	28.7	\N	\N	\N	good	2026-10-17 14:17:11.955-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:11.792Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
86	\N	28.1	\N	\N	\N	good	2026-10-17 14:17:21.955-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:21.795Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
87	\N	27.8	\N	\N	\N	good	2026-10-17 14:17:26.955-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:26.796Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
89	\N	27.2	\N	\N	\N	good	2026-10-17 14:17:36.961-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:36.798Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
90	\N	27	\N	\N	\N	good	2026-10-17 14:17:41.964-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:41.799Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
92	\N	27.3	\N	\N	\N	good	2026-10-17 14:17:51.964-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:51.800Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
93	\N	27.1	\N	\N	\N	good	2026-10-17 14:17:56.966-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:17:56.802Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
95	\N	27.9	\N	\N	\N	good	2026-10-17 14:18:06.967-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:06.804Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
96	\N	28.4	\N	\N	\N	good	2026-10-17 14:18:11.967-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:11.803Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
97	\N	28.3	\N	\N	\N	good	2026-10-17 14:18:16.969-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:16.805Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
99	\N	29.4	\N	\N	\N	good	2026-10-17 14:18:26.892-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:26.805Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
100	\N	30.1	\N	\N	\N	good	2026-10-17 14:18:31.97-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:31.806Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
101	\N	30.1	\N	\N	\N	good	2026-10-17 14:18:36.899-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:36.807Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
103	\N	31.3	\N	\N	\N	good	2026-10-17 14:18:46.901-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:46.808Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
104	\N	31.7	\N	\N	\N	good	2026-10-17 14:18:51.974-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:18:51.809Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
106	\N	32.3	\N	\N	\N	good	2026-10-17 14:19:01.984-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:01.810Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
107	\N	32.5	\N	\N	\N	good	2026-10-17 14:19:06.978-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:06.811Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
108	\N	32.7	\N	\N	\N	good	2026-10-17 14:19:11.98-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:11.812Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
110	\N	33.1	\N	\N	\N	good	2026-10-17 14:19:21.979-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:21.816Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
111	\N	32.9	\N	\N	\N	good	2026-10-17 14:19:26.981-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:26.817Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
112	\N	33	\N	\N	\N	good	2026-10-17 14:19:31.982-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:31.818Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
113	\N	32.8	\N	\N	\N	good	2026-10-17 14:19:36.982-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:36.819Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
114	\N	32.5	\N	\N	\N	good	2026-10-17 14:19:41.985-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:41.821Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
115	\N	31.9	\N	\N	\N	good	2026-10-17 14:19:47.002-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:46.820Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
116	\N	32	\N	\N	\N	good	2026-10-17 14:19:52.004-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:51.821Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
117	\N	31.4	\N	\N	\N	good	2026-10-17 14:19:56.982-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:19:56.822Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
118	\N	31.3	\N	\N	\N	good	2026-10-17 14:20:01.985-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:01.822Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
121	\N	29.8	\N	\N	\N	good	2026-10-17 14:20:16.997-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:16.825Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
122	\N	29.3	\N	\N	\N	good	2026-10-17 14:20:22.045-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:21.827Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
123	\N	28.9	\N	\N	\N	good	2026-10-17 14:20:27.019-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:26.827Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
124	\N	28.6	\N	\N	\N	good	2026-10-17 14:20:32.016-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:31.827Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
128	\N	27.3	\N	\N	\N	good	2026-10-17 14:20:51.995-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:51.831Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
131	\N	26.9	\N	\N	\N	good	2026-10-17 14:21:07.003-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:06.834Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
132	\N	27.3	\N	\N	\N	good	2026-10-17 14:21:12.029-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:11.834Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
119	\N	30.6	\N	\N	\N	good	2026-10-17 14:20:06.987-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:06.824Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
127	\N	27.5	\N	\N	\N	good	2026-10-17 14:20:46.992-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:46.830Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
130	\N	27.1	\N	\N	\N	good	2026-10-17 14:21:01.992-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:01.832Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
120	\N	30.4	\N	\N	\N	good	2026-10-17 14:20:11.983-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:11.825Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
133	\N	27.5	\N	\N	\N	good	2026-10-17 14:21:17.014-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:16.835Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
125	\N	28.1	\N	\N	\N	good	2026-10-17 14:20:37-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:36.827Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
126	\N	27.8	\N	\N	\N	good	2026-10-17 14:20:42.042-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:41.829Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
129	\N	26.8	\N	\N	\N	good	2026-10-17 14:20:56.995-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:20:56.832Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
134	\N	27.6	\N	\N	\N	good	2026-10-17 14:21:22.087-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:21.837Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
135	\N	27.9	\N	\N	\N	good	2026-10-17 14:21:27.036-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:26.838Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
136	\N	28.2	\N	\N	\N	good	2026-10-17 14:21:32.066-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:31.838Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
137	\N	28.4	\N	\N	\N	good	2026-10-17 14:21:37.029-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:36.839Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
138	\N	28.8	\N	\N	\N	good	2026-10-17 14:21:42.055-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:41.840Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
139	\N	29.4	\N	\N	\N	good	2026-10-17 14:21:47.005-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:46.840Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
140	\N	29.8	\N	\N	\N	good	2026-10-17 14:21:52-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:51.840Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
141	\N	30.4	\N	\N	\N	good	2026-10-17 14:21:57.004-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:21:56.841Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
142	\N	30.6	\N	\N	\N	good	2026-10-17 14:22:02.027-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:01.843Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
143	\N	31	\N	\N	\N	good	2026-10-17 14:22:07.006-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:06.844Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
144	\N	31.5	\N	\N	\N	good	2026-10-17 14:22:12.007-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:11.844Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
145	\N	31.9	\N	\N	\N	good	2026-10-17 14:22:17.01-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:16.845Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
146	\N	32.3	\N	\N	\N	good	2026-10-17 14:22:22.062-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:21.845Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
147	\N	33	\N	\N	\N	good	2026-10-17 14:22:27.135-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:26.847Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
148	\N	32.9	\N	\N	\N	good	2026-10-17 14:22:32.012-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:31.847Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
149	\N	33.2	\N	\N	\N	good	2026-10-17 14:22:37.078-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:36.849Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
150	\N	33.3	\N	\N	\N	good	2026-10-17 14:22:42.022-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:41.850Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
151	\N	33.2	\N	\N	\N	good	2026-10-17 14:22:47.096-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:46.851Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
152	\N	33.3	\N	\N	\N	good	2026-10-17 14:22:52.038-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:51.852Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
153	\N	32.7	\N	\N	\N	good	2026-10-17 14:22:57.038-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:22:56.853Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
154	\N	32.8	\N	\N	\N	good	2026-10-17 14:23:02.019-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:01.853Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
155	\N	32.4	\N	\N	\N	good	2026-10-17 14:23:07.061-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:06.855Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
156	\N	32.1	\N	\N	\N	good	2026-10-17 14:23:12.094-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:11.856Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
157	\N	31.8	\N	\N	\N	good	2026-10-17 14:23:17.026-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:16.858Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
158	\N	31.5	\N	\N	\N	good	2026-10-17 14:23:22.044-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:21.859Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
159	\N	30.8	\N	\N	\N	good	2026-10-17 14:23:27.021-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:26.860Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
160	\N	30.5	\N	\N	\N	good	2026-10-17 14:23:32.025-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:31.861Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
161	\N	30	\N	\N	\N	good	2026-10-17 14:23:37.049-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:36.863Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
162	\N	29.6	\N	\N	\N	good	2026-10-17 14:23:42.051-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:41.864Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
165	\N	28.1	\N	\N	\N	good	2026-10-17 14:23:57.028-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:56.867Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
173	\N	27.1	\N	\N	\N	good	2026-10-17 14:24:37.037-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:36.873Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
163	\N	29	\N	\N	\N	good	2026-10-17 14:23:47.031-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:46.866Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
166	\N	27.8	\N	\N	\N	good	2026-10-17 14:24:02.028-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:01.867Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
169	\N	26.8	\N	\N	\N	good	2026-10-17 14:24:17.036-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:16.870Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
172	\N	27	\N	\N	\N	good	2026-10-17 14:24:32.036-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:31.872Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
174	\N	27.4	\N	\N	\N	good	2026-10-17 14:24:42.057-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:41.874Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
164	\N	28.7	\N	\N	\N	good	2026-10-17 14:23:52.029-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:23:51.867Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
167	\N	27.5	\N	\N	\N	good	2026-10-17 14:24:07.031-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:06.868Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
168	\N	27.1	\N	\N	\N	good	2026-10-17 14:24:12.055-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:11.869Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
170	\N	26.9	\N	\N	\N	good	2026-10-17 14:24:22.06-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:21.871Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
171	\N	27.2	\N	\N	\N	good	2026-10-17 14:24:27.038-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:26.872Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
175	\N	27.7	\N	\N	\N	good	2026-10-17 14:24:47.057-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:46.874Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
176	\N	28.2	\N	\N	\N	good	2026-10-17 14:24:52.075-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:51.876Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
177	\N	28.4	\N	\N	\N	good	2026-10-17 14:24:57.102-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:24:56.877Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
178	\N	28.9	\N	\N	\N	good	2026-10-17 14:25:02.091-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:01.877Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
179	\N	30.3	\N	\N	\N	good	2026-10-17 14:25:17.082-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:16.885Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
180	\N	30.7	\N	\N	\N	good	2026-10-17 14:25:22.057-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:21.886Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
181	\N	31.1	\N	\N	\N	good	2026-10-17 14:25:27.052-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:26.887Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
182	\N	31.9	\N	\N	\N	good	2026-10-17 14:25:32.048-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:31.889Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
183	\N	32	\N	\N	\N	good	2026-10-17 14:25:37.048-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:36.888Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
184	\N	32.5	\N	\N	\N	good	2026-10-17 14:25:42.072-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:41.890Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
185	\N	32.5	\N	\N	\N	good	2026-10-17 14:25:47.053-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:46.889Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
186	\N	32.7	\N	\N	\N	good	2026-10-17 14:25:52.056-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:51.891Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
187	\N	33.2	\N	\N	\N	good	2026-10-17 14:25:57.054-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:25:56.892Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
188	\N	33.3	\N	\N	\N	good	2026-10-17 14:26:02.057-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:01.893Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
189	\N	33.1	\N	\N	\N	good	2026-10-17 14:26:07.057-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:06.894Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
190	\N	33	\N	\N	\N	good	2026-10-17 14:26:12.062-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:11.895Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
191	\N	33	\N	\N	\N	good	2026-10-17 14:26:17.052-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:16.896Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
192	\N	32.5	\N	\N	\N	good	2026-10-17 14:26:22.062-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:21.897Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
193	\N	32.5	\N	\N	\N	good	2026-10-17 14:26:27.087-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:26.898Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
194	\N	32.1	\N	\N	\N	good	2026-10-17 14:26:32.06-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:31.899Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
195	\N	31.9	\N	\N	\N	good	2026-10-17 14:26:37.062-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:36.899Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
196	\N	31	\N	\N	\N	good	2026-10-17 14:26:42.055-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:41.900Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
197	\N	31	\N	\N	\N	good	2026-10-17 14:26:47.059-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:46.901Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
198	\N	30.3	\N	\N	\N	good	2026-10-17 14:26:52.073-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:51.901Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
199	\N	29.7	\N	\N	\N	good	2026-10-17 14:26:57.066-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:26:56.903Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
200	\N	27.4	\N	\N	\N	good	2026-10-17 14:47:43.043-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:47:42.804Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
201	\N	27.1	\N	\N	\N	good	2026-10-17 14:47:47.994-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:47:47.804Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
202	\N	27.5	\N	\N	\N	good	2026-10-17 14:47:53.003-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:47:52.805Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
203	\N	27.6	\N	\N	\N	good	2026-10-17 14:47:57.971-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:47:57.806Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
204	\N	27.9	\N	\N	\N	good	2026-10-17 14:48:03-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:02.807Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
205	\N	28.1	\N	\N	\N	good	2026-10-17 14:48:07.977-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:07.808Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
206	\N	28.2	\N	\N	\N	good	2026-10-17 14:48:12.987-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:12.808Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
207	\N	28.3	\N	\N	\N	good	2026-10-17 14:48:17.971-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:17.810Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
208	\N	28.9	\N	\N	\N	good	2026-10-17 14:48:23.006-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:22.811Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
209	\N	29.5	\N	\N	\N	good	2026-10-17 14:48:27.975-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:27.811Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
210	\N	29.9	\N	\N	\N	good	2026-10-17 14:48:32.987-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:32.811Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
211	\N	30.6	\N	\N	\N	good	2026-10-17 14:48:37.989-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:37.812Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
212	\N	31	\N	\N	\N	good	2026-10-17 14:48:43.007-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:42.814Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
213	\N	31	\N	\N	\N	good	2026-10-17 14:48:48.002-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:47.814Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
214	\N	31.6	\N	\N	\N	good	2026-10-17 14:48:52.992-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:52.814Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
215	\N	31.9	\N	\N	\N	good	2026-10-17 14:48:57.985-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:48:57.817Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
216	\N	32.1	\N	\N	\N	good	2026-10-17 14:49:02.987-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:02.817Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
217	\N	32.4	\N	\N	\N	good	2026-10-17 14:49:07.982-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:07.818Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
218	\N	33	\N	\N	\N	good	2026-10-17 14:49:12.982-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:12.819Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
219	\N	32.8	\N	\N	\N	good	2026-10-17 14:49:17.988-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:17.821Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
220	\N	33.2	\N	\N	\N	good	2026-10-17 14:49:22.986-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:22.822Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
221	\N	33.4	\N	\N	\N	good	2026-10-17 14:49:27.991-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:27.823Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
222	\N	33.3	\N	\N	\N	good	2026-10-17 14:49:32.986-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:32.823Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
223	\N	33	\N	\N	\N	good	2026-10-17 14:49:38.026-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:37.825Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
224	\N	32.7	\N	\N	\N	good	2026-10-17 14:49:43.025-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:42.826Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
225	\N	32.6	\N	\N	\N	good	2026-10-17 14:49:48.016-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:47.826Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
226	\N	32	\N	\N	\N	good	2026-10-17 14:49:53.028-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:52.826Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
227	\N	31.7	\N	\N	\N	good	2026-10-17 14:49:58.004-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:49:57.828Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
228	\N	31.6	\N	\N	\N	good	2026-10-17 14:50:03.016-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:02.829Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
229	\N	30.7	\N	\N	\N	good	2026-10-17 14:50:08.025-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:07.829Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
230	\N	30.4	\N	\N	\N	good	2026-10-17 14:50:13.011-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:12.830Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
231	\N	29.8	\N	\N	\N	good	2026-10-17 14:50:18.031-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:17.830Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
232	\N	29.3	\N	\N	\N	good	2026-10-17 14:50:23.019-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:22.831Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
236	\N	28.1	\N	\N	\N	good	2026-10-17 14:50:43.01-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:42.834Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
237	\N	27.8	\N	\N	\N	good	2026-10-17 14:50:47.985-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:47.836Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
233	\N	29	\N	\N	\N	good	2026-10-17 14:50:28.036-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:27.832Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
240	\N	26.9	\N	\N	\N	good	2026-10-17 14:51:03.003-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:02.840Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
243	\N	27.1	\N	\N	\N	good	2026-10-17 14:51:18.009-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:17.843Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
234	\N	28.5	\N	\N	\N	good	2026-10-17 14:50:33.003-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:32.832Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
239	\N	27.3	\N	\N	\N	good	2026-10-17 14:50:58.002-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:57.839Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
235	\N	28.1	\N	\N	\N	good	2026-10-17 14:50:38.023-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:37.834Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
244	\N	27.6	\N	\N	\N	good	2026-10-17 14:51:23.037-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:22.843Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
245	\N	27.9	\N	\N	\N	good	2026-10-17 14:51:28.039-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:27.843Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
238	\N	27.2	\N	\N	\N	good	2026-10-17 14:50:52.998-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:50:52.838Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
241	\N	27.2	\N	\N	\N	good	2026-10-17 14:51:08.008-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:07.841Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
242	\N	26.8	\N	\N	\N	good	2026-10-17 14:51:13.005-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:12.842Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
246	\N	27.9	\N	\N	\N	good	2026-10-17 14:51:33.005-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:32.844Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
247	\N	28.4	\N	\N	\N	good	2026-10-17 14:51:38.033-06	{"fuente": "simulador-node-red", "timestamp": "2026-10-17T20:51:37.845Z", "dispositivo": "PCL-PRINCIPAL", "integracion_usuario": "e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f"}	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6
259	\N	22	\N	\N	\N	good	2026-10-21 22:30:00.803-06	{"fuente": "integracion", "dispositivo": "PLC-QUIROFANO", "integracion_usuario": "cd003c8e-61bb-4109-ae18-7735c2a31622"}	4d617900-215e-4c9e-9334-da2a1406b4a7
\.


--
-- Data for Name: reglas_alerta; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reglas_alerta (id, canal_id, nombre, descripcion, operador, valor_referencia_numerico, valor_referencia_texto, valor_referencia_booleano, valor_min, valor_max, severidad, mensaje, activa, retardo_segundos, creado_en, actualizado_en, histeresis, plantilla_id, norma, requiere_verificacion) FROM stdin;
0f77fd12-4a67-49a3-b639-77328829945d	8829e66a-cdef-4ebc-8c9b-cd8d60ffc2f6	Temperatura flexi alta	\N	>	32	\N	\N	\N	\N	critical	LA temperatura está muy alta.	t	\N	2026-10-18 21:34:00.691104-06	2026-10-18 21:34:00.691104-06	\N	\N	\N	f
\.


--
-- Data for Name: sensores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sensores (id, dispositivo_id, tipo_variable_id, nombre, codigo, fabricante, modelo, unidad, rango_min, rango_max, "precision", activo, configuracion, creado_en) FROM stdin;
c4806045-b4d1-446c-a6bf-d21f2583c7f5	7eab7e87-9eea-4af5-a7d1-ef137ac547f0	2cfc6e18-484e-46a8-86e5-6308aab2a1ea	DHT Quirófano	DHT-QUIROFANO	\N	\N	\N	\N	\N	\N	t	{}	2026-10-15 22:43:29.570569-06
f4dbe06e-e7f4-4b98-8f83-7780a78d3162	060d73a0-92dc-4329-8e69-f037e814098e	\N	TEMP-01	TEMP-01	\N	PT	\N	\N	\N	\N	t	{}	2026-10-15 22:53:35.474285-06
\.


--
-- Data for Name: tipos_variable; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tipos_variable (id, codigo, nombre, descripcion, tipo_dato, unidad_default, categoria, permite_reglas) FROM stdin;
2cfc6e18-484e-46a8-86e5-6308aab2a1ea	TEMPERATURA	Temperatura	Magnitud térmica.	numeric	°C	ambiental	t
1d3de6ac-147d-44b5-b9e5-6911d2465e0e	HUMEDAD_RELATIVA	Humedad relativa	Porcentaje de humedad relativa.	numeric	%	ambiental	t
8c2e1281-a0eb-4869-a749-d2f50400a4c9	PRESION	Presión	Presión atmosférica o barométrica.	numeric	hPa	ambiental	t
b0e6c5bd-7d86-430a-a19d-b113c00fdb2d	CO2	CO2	Dióxido de carbono.	numeric	ppm	ambiental	t
40b2c00d-77ab-47b4-aac2-fdcb42e71076	VOC	Compuestos orgánicos volátiles	Vigilancia calidad de aire.	numeric	ppm	ambiental	t
6f097479-f036-481e-9761-b2a48c96ee19	VOLTAJE	Voltaje	Tensión eléctrica.	numeric	V	electrica	t
0a4ef6c5-548d-47c7-b880-5f99073a0db3	CORRIENTE	Corriente	Intensidad eléctrica.	numeric	A	electrica	t
e79d2dd9-0313-492a-a6ef-52abe6b469a4	POTENCIA	Potencia	Potencia eléctrica activa.	numeric	W	electrica	t
310831f8-6ca6-4b40-b143-0b1a22a50f69	FRECUENCIA	Frecuencia	Frecuencia de la señal.	numeric	Hz	electrica	t
c64f0181-9656-4736-b9d1-ff52e3e83eba	FACTOR_POTENCIA	Factor de potencia	Relación potencia útil/aparente (0–1).	numeric		electrica	t
b07d8a32-6273-466e-a139-14284f5540c3	NIVEL	Nivel	Nivel de líquido, tanque o tolva.	numeric	%	industrial	t
85cc2cba-6f10-4c7d-a6c5-159dcf43356b	ESTADO_MOTOR	Estado motor	Estado on/off de un motor o actuador.	boolean		estado	t
bbc24420-489c-42ad-b43c-f751b3115ae1	ESTADO_ENCHUFADO	Estado enchufado	Estado de un contacto o puerta (abierto/cerrado).	boolean		estado	t
97b2fd29-abf8-48d1-80ec-6959ee4758f1	ESTADO_SISTEMA	Estado sistema	Texto de estado del sistema (ok, error, mantenimiento...).	text		estado	t
e175e108-b890-47f4-97d2-429616a9021c	TIPO_EVENTO	Tipo evento	Texto libre que describe un evento o mensaje.	text		estado	f
e0ab8c96-a3c8-4a04-81e2-c3009fe8473a	CONFIG_JSON	Configuración JSON	Magnitud genérica sin reglas (JSON).	json		configuracion	f
\.


--
-- Data for Name: umbrales; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.umbrales (id, sensor_id, valor_min, valor_max, severidad, activo, creado_en) FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, nombre, email, hash_contra, rol, activo, creado_en) FROM stdin;
cd003c8e-61bb-4109-ae18-7735c2a31622	Administrador	admin@monitoreo.local	$2b$10$2izHaF41WZesq2toCrb6Q.KhIbvGutJyjb8S6vWtx5sda1qflg6fy	admin	t	2026-09-02 19:53:57.774651-06
9bf4fbd5-662e-459e-93b4-0a97ca2ab4a4	Jaime120	jaime@test.com	$2b$10$YGop0Ows1A5diZX1TVxtlO6vIAp516XuLQprdlrVs7PtIUjjFaXmO	usuario	t	2026-09-02 20:14:14.891042-06
0958eb68-9977-47d2-ad29-95f507560467	Test 123	test@test.com	$2b$10$5E0l4mTNbhJPzKqjbe4S1uPoRTAsbU7TstASpUaqTTq3xdn31LHYO	usuario	t	2026-09-02 21:26:08.654715-06
e94a0c07-f6c7-4ac4-9de4-976f7d3fea0f	donjoe	donjoe@test.com	$2b$10$AYhuLT4To99TH3665XNYU.39gvKzAbzVcl/2fGLHCYulC3lJQ850C	usuario	t	2026-09-11 20:50:08.823128-06
\.


--
-- Name: mediciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mediciones_id_seq', 259, true);


--
-- Name: _migraciones_aplicadas _migraciones_aplicadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migraciones_aplicadas
    ADD CONSTRAINT _migraciones_aplicadas_pkey PRIMARY KEY (archivo);


--
-- Name: actuadores actuadores_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actuadores
    ADD CONSTRAINT actuadores_codigo_key UNIQUE (codigo);


--
-- Name: actuadores actuadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actuadores
    ADD CONSTRAINT actuadores_pkey PRIMARY KEY (id);


--
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- Name: alertas_retardo alertas_retardo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_retardo
    ADD CONSTRAINT alertas_retardo_pkey PRIMARY KEY (regla_id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: camaras camaras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camaras
    ADD CONSTRAINT camaras_pkey PRIMARY KEY (id);


--
-- Name: canales canales_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canales
    ADD CONSTRAINT canales_codigo_key UNIQUE (codigo);


--
-- Name: canales canales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canales
    ADD CONSTRAINT canales_pkey PRIMARY KEY (id);


--
-- Name: claves_api claves_api_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claves_api
    ADD CONSTRAINT claves_api_pkey PRIMARY KEY (id);


--
-- Name: comandos_actuador comandos_actuador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandos_actuador
    ADD CONSTRAINT comandos_actuador_pkey PRIMARY KEY (id);


--
-- Name: dispositivos dispositivos_identificador_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_identificador_key UNIQUE (identificador);


--
-- Name: dispositivos dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_pkey PRIMARY KEY (id);


--
-- Name: integraciones integraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integraciones
    ADD CONSTRAINT integraciones_pkey PRIMARY KEY (id);


--
-- Name: mediciones mediciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones
    ADD CONSTRAINT mediciones_pkey PRIMARY KEY (id);


--
-- Name: reglas_alerta reglas_alerta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_alerta
    ADD CONSTRAINT reglas_alerta_pkey PRIMARY KEY (id);


--
-- Name: sensores sensores_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensores
    ADD CONSTRAINT sensores_codigo_key UNIQUE (codigo);


--
-- Name: sensores sensores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensores
    ADD CONSTRAINT sensores_pkey PRIMARY KEY (id);


--
-- Name: tipos_variable tipos_variable_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_variable
    ADD CONSTRAINT tipos_variable_codigo_key UNIQUE (codigo);


--
-- Name: tipos_variable tipos_variable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_variable
    ADD CONSTRAINT tipos_variable_pkey PRIMARY KEY (id);


--
-- Name: umbrales umbrales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umbrales
    ADD CONSTRAINT umbrales_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_actuadores_dispositivo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actuadores_dispositivo_id ON public.actuadores USING btree (dispositivo_id);


--
-- Name: idx_actuadores_protocolo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actuadores_protocolo ON public.actuadores USING btree (protocolo);


--
-- Name: idx_alertas_canal_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_canal_estado ON public.alertas USING btree (canal_id, estado);


--
-- Name: idx_alertas_regla_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_regla_abiertas ON public.alertas USING btree (regla_id) WHERE ((estado)::text = ANY ((ARRAY['active'::character varying, 'acknowledged'::character varying])::text[]));


--
-- Name: idx_alertas_regla_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_regla_estado ON public.alertas USING btree (regla_id, estado);


--
-- Name: idx_areas_propietario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_areas_propietario ON public.areas USING btree (propietario_id);


--
-- Name: idx_camaras_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camaras_area ON public.camaras USING btree (area_id);


--
-- Name: idx_camaras_dispositivo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camaras_dispositivo ON public.camaras USING btree (dispositivo_id);


--
-- Name: idx_camaras_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camaras_estado ON public.camaras USING btree (estado);


--
-- Name: idx_camaras_propietario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camaras_propietario ON public.camaras USING btree (propietario_id);


--
-- Name: idx_camaras_ruta_webrtc_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_camaras_ruta_webrtc_unica ON public.camaras USING btree (ruta_webrtc) WHERE (ruta_webrtc IS NOT NULL);


--
-- Name: idx_claves_api_prefijo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claves_api_prefijo ON public.claves_api USING btree (prefijo);


--
-- Name: idx_claves_api_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_claves_api_usuario_id ON public.claves_api USING btree (usuario_id);


--
-- Name: idx_comandos_actuador_actuador_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandos_actuador_actuador_creado ON public.comandos_actuador USING btree (actuador_id, creado_en DESC);


--
-- Name: idx_comandos_actuador_clave_api_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandos_actuador_clave_api_id ON public.comandos_actuador USING btree (clave_api_id);


--
-- Name: idx_comandos_actuador_creado_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandos_actuador_creado_en ON public.comandos_actuador USING btree (creado_en DESC);


--
-- Name: idx_comandos_actuador_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandos_actuador_pendientes ON public.comandos_actuador USING btree (creado_en) WHERE ((estado)::text = 'pendiente'::text);


--
-- Name: idx_comandos_actuador_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandos_actuador_usuario_id ON public.comandos_actuador USING btree (usuario_id);


--
-- Name: idx_dispositivos_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_area ON public.dispositivos USING btree (area_id);


--
-- Name: idx_dispositivos_propietario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_propietario ON public.dispositivos USING btree (propietario_id);


--
-- Name: idx_mediciones_canal_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mediciones_canal_timestamp ON public.mediciones USING btree (canal_id, registrado_en DESC);


--
-- Name: idx_mediciones_origen_en; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mediciones_origen_en ON public.mediciones USING btree (((metadatos ->> 'origen_en'::text))) WHERE (metadatos ? 'origen_en'::text);


--
-- Name: idx_mediciones_sensor_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mediciones_sensor_timestamp ON public.mediciones USING btree (sensor_id, registrado_en DESC);


--
-- Name: idx_reglas_alerta_plantilla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_alerta_plantilla ON public.reglas_alerta USING btree (plantilla_id) WHERE (plantilla_id IS NOT NULL);


--
-- Name: idx_reglas_canal_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_canal_activa ON public.reglas_alerta USING btree (canal_id) WHERE (activa = true);


--
-- Name: idx_sensores_dispositivo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sensores_dispositivo_id ON public.sensores USING btree (dispositivo_id);


--
-- Name: actuadores actuadores_dispositivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actuadores
    ADD CONSTRAINT actuadores_dispositivo_id_fkey FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE CASCADE;


--
-- Name: alertas alertas_canal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES public.canales(id) ON DELETE CASCADE;


--
-- Name: alertas alertas_medicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_medicion_id_fkey FOREIGN KEY (medicion_id) REFERENCES public.mediciones(id) ON DELETE CASCADE;


--
-- Name: alertas alertas_reconocida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_reconocida_por_fkey FOREIGN KEY (reconocida_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: alertas alertas_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas_alerta(id) ON DELETE SET NULL;


--
-- Name: alertas_retardo alertas_retardo_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_retardo
    ADD CONSTRAINT alertas_retardo_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas_alerta(id) ON DELETE CASCADE;


--
-- Name: alertas alertas_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensores(id) ON DELETE CASCADE;


--
-- Name: areas areas_propietario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: camaras camaras_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camaras
    ADD CONSTRAINT camaras_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE SET NULL;


--
-- Name: camaras camaras_dispositivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camaras
    ADD CONSTRAINT camaras_dispositivo_id_fkey FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE SET NULL;


--
-- Name: camaras camaras_propietario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camaras
    ADD CONSTRAINT camaras_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: canales canales_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canales
    ADD CONSTRAINT canales_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensores(id) ON DELETE CASCADE;


--
-- Name: canales canales_tipo_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canales
    ADD CONSTRAINT canales_tipo_variable_id_fkey FOREIGN KEY (tipo_variable_id) REFERENCES public.tipos_variable(id);


--
-- Name: claves_api claves_api_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claves_api
    ADD CONSTRAINT claves_api_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: comandos_actuador comandos_actuador_actuador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandos_actuador
    ADD CONSTRAINT comandos_actuador_actuador_id_fkey FOREIGN KEY (actuador_id) REFERENCES public.actuadores(id) ON DELETE CASCADE;


--
-- Name: comandos_actuador comandos_actuador_clave_api_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandos_actuador
    ADD CONSTRAINT comandos_actuador_clave_api_id_fkey FOREIGN KEY (clave_api_id) REFERENCES public.claves_api(id) ON DELETE SET NULL;


--
-- Name: comandos_actuador comandos_actuador_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandos_actuador
    ADD CONSTRAINT comandos_actuador_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: dispositivos dispositivos_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE CASCADE;


--
-- Name: dispositivos dispositivos_propietario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: integraciones integraciones_dispositivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integraciones
    ADD CONSTRAINT integraciones_dispositivo_id_fkey FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE CASCADE;


--
-- Name: mediciones mediciones_canal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones
    ADD CONSTRAINT mediciones_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES public.canales(id) ON DELETE CASCADE;


--
-- Name: mediciones mediciones_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones
    ADD CONSTRAINT mediciones_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensores(id) ON DELETE CASCADE;


--
-- Name: reglas_alerta reglas_alerta_canal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_alerta
    ADD CONSTRAINT reglas_alerta_canal_id_fkey FOREIGN KEY (canal_id) REFERENCES public.canales(id) ON DELETE CASCADE;


--
-- Name: sensores sensores_dispositivo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensores
    ADD CONSTRAINT sensores_dispositivo_id_fkey FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE CASCADE;


--
-- Name: sensores sensores_tipo_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensores
    ADD CONSTRAINT sensores_tipo_variable_id_fkey FOREIGN KEY (tipo_variable_id) REFERENCES public.tipos_variable(id);


--
-- Name: umbrales umbrales_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.umbrales
    ADD CONSTRAINT umbrales_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensores(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rDSc4VjehMa3hHhZvvZGG523YJ6j7Yd26J1OkclhTfuUHyVwf8qPxMy6yiTgjrk

