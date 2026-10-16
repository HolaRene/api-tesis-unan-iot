/**
 * Direccionamiento de actuadores: cómo se acciona cada salida.
 *
 * ────────────────────────────────────────────────────────────────────
 * EL PROBLEMA QUE RESUELVE
 * ────────────────────────────────────────────────────────────────────
 * Un comando con el CÓDIGO del actuador no sirve para un PLC:
 *
 *     { "actuador": "LED-1", "comando": "ON" }     ← el PLC no sabe qué es esto
 *
 * Un PLC solo entiende «en la dirección 100, pon un 1», y eso activa lo que
 * esté cableado a esa salida. La dirección es un dato de la INSTALACIÓN, no
 * del software: hay que poder configurarla por actuador.
 *
 * Y no todos los equipos hablan el mismo idioma. De ahí los protocolos:
 *
 *   modbus → coil/registro + dirección numérica  (PLC industrial)
 *   gpio   → número de pin                       (ESP32, Arduino, Raspberry)
 *   mqtt   → tema propio                         (cualquier equipo conectado)
 *   http   → URL de un endpoint                  (sin intermediarios)
 *
 * ────────────────────────────────────────────────────────────────────
 * POR QUÉ EL DETALLE VA EN `configuracion` (JSONB)
 * ────────────────────────────────────────────────────────────────────
 * Cada protocolo necesita campos distintos (Modbus quiere dirección y tipo
 * de registro; GPIO quiere un pin). Con columnas fijas habría que añadir
 * columnas nulas para todos los protocolos, y cada protocolo nuevo exigiría
 * migrar la tabla.
 *
 * La columna `protocolo` sí es columna normal: permite filtrar y contar por
 * tipo con SQL corriente.
 */
import { z } from 'zod';

/** Protocolos soportados. */
export const PROTOCOLOS_ACTUADOR = ['modbus', 'gpio', 'mqtt', 'http'] as const;

export type ProtocoloActuador = (typeof PROTOCOLOS_ACTUADOR)[number];

/* ── MODBUS ───────────────────────────────────────────────────────── */

/**
 * Tipos de dato Modbus que se pueden escribir.
 *
 * Solo se admiten los de ESCRITURA: los de lectura (discrete input, input
 * register) no sirven para accionar nada.
 */
export const TIPOS_MODBUS_ESCRITURA = ['coil', 'holding'] as const;

export type TipoModbusEscritura = (typeof TIPOS_MODBUS_ESCRITURA)[number];

/**
 * Configuración Modbus de un actuador.
 *
 * `direccion` es el número que entiende el PLC (0, 100, 40001…). Se admiten
 * hasta 65535 porque algunos PLC usan la notación de 5 dígitos (40001), donde
 * el primer dígito indica la zona y los cuatro restantes la dirección.
 *
 * `unidad_id` es el esclavo Modbus. Con un gateway o un PLC por área, varios
 * actuadores comparten unidad.
 */
export const configuracionModbusSchema = z.object({
  tipo: z.enum(TIPOS_MODBUS_ESCRITURA, {
    message: 'El tipo debe ser coil o holding',
  }),
  direccion: z
    .number()
    .int('La dirección debe ser un número entero')
    .min(0, 'La dirección no puede ser negativa')
    .max(65535, 'La dirección no puede superar 65535'),
  unidad_id: z
    .number()
    .int('La unidad debe ser un número entero')
    .min(0, 'La unidad no puede ser negativa')
    .max(255, 'La unidad no puede superar 255')
    .optional(),
  /** Valor a escribir para "encendido" en un registro holding. */
  valor_on: z.number().int().optional(),
  /** Valor a escribir para "apagado" en un registro holding. */
  valor_off: z.number().int().optional(),
});

/* ── GPIO ─────────────────────────────────────────────────────────── */

/**
 * Configuración GPIO de un actuador.
 *
 * `nivel_activo` resuelve un problema real: muchos relés se activan con nivel
 * BAJO (0 V), así que escribir un 1 los APAGA. Sin este campo habría que
 * invertir la lógica en el firmware, que es donde resulta más difícil de
 * encontrar.
 */
export const configuracionGpioSchema = z.object({
  pin: z
    .number()
    .int('El pin debe ser un número entero')
    .min(0, 'El pin no puede ser negativo')
    .max(255, 'El pin no puede superar 255'),
  nivel_activo: z
    .union([z.literal(1), z.literal(0)])
    .optional()
    .describe('Nivel que activa la salida: 1 normal, 0 para relés invertidos'),
  modo: z.enum(['digital', 'pwm']).optional(),
});

/* ── MQTT ─────────────────────────────────────────────────────────── */

/**
 * Configuración MQTT de un actuador.
 *
 * Si no se indica tema, se deriva del código: `hospital/quirofano/cmd/<codigo>`.
 */
export const configuracionMqttSchema = z.object({
  topico: z
    .string()
    .trim()
    .min(1, 'El tema no puede estar vacío')
    .max(200, 'El tema no puede superar 200 caracteres')
    .optional(),
  payload_on: z.string().max(100).optional(),
  payload_off: z.string().max(100).optional(),
});

/* ── HTTP ─────────────────────────────────────────────────────────── */

/**
 * Configuración HTTP de un actuador.
 *
 * Pensado para equipos que exponen su propia API (ESP32 con servidor web).
 * La API NO llama a esta URL: la incluye en el comando para que la use quien
 * corresponda (Node-RED o un script de integración).
 */
export const configuracionHttpSchema = z.object({
  url: z
    .string()
    .trim()
    .url('La URL no es válida')
    .max(500, 'La URL no puede superar 500 caracteres'),
  metodo: z.enum(['GET', 'POST', 'PUT']).optional(),
});

/* ── Esquema por protocolo ────────────────────────────────────────── */

/**
 * Valida `configuracion` según el protocolo.
 *
 * Se exporta como mapa para poder construir el esquema del formulario sin
 * duplicar la lista de protocolos.
 */
export const ESQUEMA_POR_PROTOCOLO = {
  modbus: configuracionModbusSchema,
  gpio: configuracionGpioSchema,
  mqtt: configuracionMqttSchema,
  http: configuracionHttpSchema,
} as const;

/** Etiquetas legibles, para mensajes de error y para la interfaz. */
export const ETIQUETA_PROTOCOLO: Record<ProtocoloActuador, string> = {
  modbus: 'Modbus (PLC)',
  gpio: 'GPIO (ESP32/Arduino)',
  mqtt: 'MQTT',
  http: 'HTTP',
};

/**
 * Comprueba que un actuador tenga la dirección COMPLETA para su protocolo.
 *
 * Un actuador sin dirección no se puede accionar: el comando llegaría al
 * equipo sin decirle dónde escribir. Es mejor rechazarlo al guardarlo que
 * descubrirlo cuando un operario pulse el botón y no ocurra nada.
 *
 * Devuelve la lista de problemas; vacía significa que está bien.
 */
export function validarDireccionamiento(
  protocolo: string,
  configuracion: unknown
): string[] {
  const esquema = ESQUEMA_POR_PROTOCOLO[protocolo as ProtocoloActuador];

  // MQTT sin configuración es válido: el tema se deriva del código.
  if (protocolo === 'mqtt') {
    const r = esquema.safeParse(configuracion ?? {});
    return r.success ? [] : r.error.issues.map((i) => i.message);
  }

  if (!esquema) {
    return [`El protocolo «${protocolo}» no está soportado`];
  }

  if (configuracion === null || configuracion === undefined) {
    return [
      `El protocolo ${ETIQUETA_PROTOCOLO[protocolo as ProtocoloActuador] ?? protocolo} necesita una dirección configurada`,
    ];
  }

  const r = esquema.safeParse(configuracion);
  if (r.success) return [];

  return r.error.issues.map((i) => {
    const campo = i.path.join('.');
    return campo ? `${campo}: ${i.message}` : i.message;
  });
}

/**
 * Construye el bloque de direccionamiento que viaja en el comando.
 *
 * Esto es lo que recibe Node-RED (o el equipo directamente) para saber DÓNDE
 * accionar. Antes solo iba el código del actuador, que un PLC no entiende.
 */
export interface Direccionamiento {
  protocolo: ProtocoloActuador;
  /** Modbus: tipo de registro, dirección y unidad. */
  tipo?: TipoModbusEscritura;
  direccion?: number;
  unidad_id?: number;
  /** GPIO: pin y nivel que lo activa. */
  pin?: number;
  nivel_activo?: number;
  /** MQTT: tema al que publicar. */
  topico?: string;
  /** HTTP: URL y método. */
  url?: string;
  metodo?: string;
  /** Valores concretos a escribir cuando el protocolo los admite. */
  valor_on?: number | string;
  valor_off?: number | string;
  /** Configuración original, para protocolos o campos que no se listan. */
  configuracion: Record<string, unknown>;
}

/**
 * Traduce la configuración de un actuador a un bloque de direccionamiento
 * listo para viajar en el comando.
 *
 * Se APLANA la estructura (en lugar de anidar `configuracion`) para que
 * Node-RED pueda leer `msg.payload.direccionamiento.direccion` sin navegar
 * dentro de un objeto genérico. Se conserva también el original en
 * `configuracion` por si hay campos que no se listan.
 */
export function construirDireccionamiento(
  protocolo: string,
  configuracion: Record<string, unknown> | null | undefined
): Direccionamiento {
  const cfg = (configuracion ?? {}) as Record<string, unknown>;
  const proto = (PROTOCOLOS_ACTUADOR as readonly string[]).includes(protocolo)
    ? (protocolo as ProtocoloActuador)
    : 'mqtt';

  const dir: Direccionamiento = { protocolo: proto, configuracion: cfg };

  if (proto === 'modbus') {
    if (typeof cfg.tipo === 'string') dir.tipo = cfg.tipo as TipoModbusEscritura;
    if (typeof cfg.direccion === 'number') dir.direccion = cfg.direccion;
    if (typeof cfg.unidad_id === 'number') dir.unidad_id = cfg.unidad_id;
    /*
     * En un coil solo existen 1 y 0. Si no se configuran valores explícitos
     * para un registro holding, se escriben 1 y 0, que es lo que espera la
     * mayoría de PLC.
     */
    dir.valor_on =
      typeof cfg.valor_on === 'number' ? cfg.valor_on : 1;
    dir.valor_off =
      typeof cfg.valor_off === 'number' ? cfg.valor_off : 0;
  }

  if (proto === 'gpio') {
    if (typeof cfg.pin === 'number') dir.pin = cfg.pin;
    /*
     * Por defecto nivel activo ALTO (1). Los relés invertidos se configuran
     * con 0.
     */
    dir.nivel_activo = cfg.nivel_activo === 0 ? 0 : 1;
    dir.valor_on = dir.nivel_activo;
    dir.valor_off = dir.nivel_activo === 1 ? 0 : 1;
  }

  if (proto === 'mqtt') {
    if (typeof cfg.topico === 'string') dir.topico = cfg.topico;
    dir.valor_on = typeof cfg.payload_on === 'string' ? cfg.payload_on : 'ON';
    dir.valor_off = typeof cfg.payload_off === 'string' ? cfg.payload_off : 'OFF';
  }

  if (proto === 'http') {
    if (typeof cfg.url === 'string') dir.url = cfg.url;
    dir.metodo = typeof cfg.metodo === 'string' ? cfg.metodo : 'POST';
    dir.valor_on = 1;
    dir.valor_off = 0;
  }

  return dir;
}
