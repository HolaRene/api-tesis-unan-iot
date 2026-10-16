/**
 * Generación de identificadores y códigos únicos.
 *
 * ────────────────────────────────────────────────────────────────────
 * POR QUÉ EL BACKEND Y NO EL USUARIO
 * ────────────────────────────────────────────────────────────────────
 * `dispositivos.identificador` y `canales.codigo` tienen restricción UNIQUE
 * en toda la base de datos: son la CLAVE con la que un equipo o una medición
 * se identifica, así que no pueden repetirse ni cambiarse a la ligera.
 *
 * Dejar que se escriban a mano desde el frontend provoca:
 *
 *   - Duplicados: dos usuarios inventan el mismo código y uno falla al guardar
 *     con un error de base de datos poco claro.
 *   - Inconsistencias: "TEMP1", "temp-1" y "Temp_1" para el mismo concepto.
 *   - Roturas: cambiar el código de un sensor que ya envía datos deja huérfanas
 *     las mediciones anteriores.
 *
 * Generándolos aquí, el identificador es SIEMPRE único, legible y estable.
 *
 * ────────────────────────────────────────────────────────────────────
 * PORTABILIDAD
 * ────────────────────────────────────────────────────────────────────
 * La `normalizar` quita los acentos antes de generar. Sin eso, "Quirófano"
 * produciría "QUIR-FANO" al descartar la "ó", y el identificador dejaría de
 * parecerse al nombre.
 */

/**
 * Convierte un texto libre en un identificador estable.
 *
 *   "Quirófano 1"      → "QUIROFANO-1"
 *   "Sensor  de   Área" → "SENSOR-DE-AREA"
 *   "  --prueba--  "    → "PRUEBA"
 *
 * @param texto      Nombre del que derivar el identificador.
 * @param separador  Carácter que une las palabras (por defecto `-`).
 * @param mayusculas Si el resultado va en mayúsculas (por defecto sí).
 */
export function normalizarIdentificador(
  texto: string,
  separador = '-',
  mayusculas = true
): string {
  const limpio = texto
    .normalize('NFD')
    // Elimina las marcas diacríticas (tildes) que la descomposición separó.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, separador)
    .replace(new RegExp(`\\${separador}{2,}`, 'g'), separador)
    .replace(new RegExp(`^\\${separador}|\\${separador}$`, 'g'), '');

  return mayusculas ? limpio.toUpperCase() : limpio.toLowerCase();
}

/**
 * Añade un sufijo numérico a un identificador base.
 *
 * Se usa cuando el base ya está ocupado:
 *
 *   base "SENSOR-1", intento 1 → "SENSOR-1"
 *   base "SENSOR-1", intento 2 → "SENSOR-1-2"
 *   base "SENSOR-1", intento 3 → "SENSOR-1-3"
 *
 * El primer intento NO lleva sufijo: así el caso normal (no hay colisión)
 * produce el identificador limpio.
 */
export function conSufijo(base: string, intento: number): string {
  return intento <= 1 ? base : `${base}-${intento}`;
}

/**
 * Busca un identificador libre probando sufijos incrementales.
 *
 * @param base       Identificador de partida, ya normalizado.
 * @param estaOcupado Función que comprueba si un candidato ya existe.
 * @param maxIntentos Límite de seguridad para no generar un bucle infinito.
 *
 * @throws Si no encuentra ninguno libre en `maxIntentos` intentos. Es
 *         preferible fallar de forma explícita a devolver un duplicado que
 *         la base de datos rechazaría con un error opaco.
 */
export async function identificadorUnico(
  base: string,
  estaOcupado: (candidato: string) => Promise<boolean>,
  maxIntentos = 100
): Promise<string> {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const candidato = conSufijo(base, intento);
    if (!(await estaOcupado(candidato))) return candidato;
  }

  throw new Error(
    `No se pudo generar un identificador único para "${base}" tras ${maxIntentos} intentos`
  );
}

/**
 * Genera el identificador de un dispositivo a partir de su nombre.
 *
 * Si el nombre no produce nada utilizable (por ejemplo, solo símbolos), se
 * usa un prefijo genérico para no dejar el campo vacío: el identificador es
 * obligatorio para la integración.
 */
export function identificadorDeDispositivo(nombre: string): string {
  const base = normalizarIdentificador(nombre);
  return base || 'DISPOSITIVO';
}

/**
 * Genera el código de un canal a partir del código del sensor y la magnitud.
 *
 * Formato: `<CODIGO_SENSOR>-<CODIGO_MAGNITUD>`
 *
 *   Sensor DHT1W + magnitud TEMPERATURA         → "DHT1W-TEMPERATURA"
 *   Sensor DHT1W + magnitud HUMEDAD_RELATIVA    → "DHT1W-HUMEDAD-RELATIVA"
 *
 * Este código es el que usa el equipo en el payload de mediciones
 * (`{"canal": "DHT1W-TEMPERATURA", "valor": 24.8}`), así que debe ser estable
 * y predecible.
 */
export function codigoDeCanal(
  codigoSensor: string,
  codigoMagnitud?: string | null
): string {
  const sensor = normalizarIdentificador(codigoSensor);
  if (!codigoMagnitud) return sensor || 'CANAL';

  const magnitud = normalizarIdentificador(codigoMagnitud);
  /*
   * Si el sensor ya termina con la magnitud (caso habitual cuando el sensor
   * tiene una sola magnitud), no se repite: "DHT1W" + "DHT1W-TEMPERATURA"
   * no debe dar "DHT1W-DHT1W-TEMPERATURA".
   */
  if (sensor.endsWith(magnitud)) return sensor;

  return `${sensor}-${magnitud}`;
}

/**
 * Genera el código de un actuador a partir de su nombre y su tipo.
 *
 * Formato: `<TIPO>-<NOMBRE>` cuando el nombre no incluye ya el tipo.
 *
 *   "Buzzer Quirófano" + "buzzer"        → "BUZZER-QUIROFANO"
 *   "Buzzer"           + "buzzer"        → "BUZZER"       (no repite)
 *   "Relé 1"           + "digital_out"   → "DIGITAL-OUT-RELE-1"
 *   "Compuerta A"      + ""              → "COMPUERTA-A"
 *
 * ────────────────────────────────────────────────────────────────────
 * POR QUÉ SE PREFIJA EL TIPO
 * ────────────────────────────────────────────────────────────────────
 * El código del actuador forma parte del TEMA MQTT al que Node-RED publica
 * las órdenes (`hospital/quirofano/cmd/RELE-1`). Que empiece por el tipo hace
 * el tema autoexplicativo: al ver `cmd/BUZZER-QUIROFANO` se sabe qué se está
 * accionando sin consultar la base de datos.
 *
 * El tipo se normaliza igual que el nombre, así que "digital_out" produce
 * "DIGITAL-OUT" y el tema resultante no lleva guiones bajos.
 */
export function codigoDeActuador(
  nombre: string,
  tipo?: string | null
): string {
  const nombreNorm = normalizarIdentificador(nombre);
  const tipoNorm = tipo ? normalizarIdentificador(tipo) : '';

  // Sin tipo utilizable, el nombre por sí solo.
  if (!tipoNorm) return nombreNorm || 'ACTUADOR';

  /*
   * Si el nombre YA empieza por el tipo, no se duplica:
   * "Buzzer Quirófano" + "buzzer" no debe dar "BUZZER-BUZZER-QUIROFANO".
   */
  if (nombreNorm.startsWith(tipoNorm)) return nombreNorm;

  if (!nombreNorm) return tipoNorm;

  return `${tipoNorm}-${nombreNorm}`;
}
