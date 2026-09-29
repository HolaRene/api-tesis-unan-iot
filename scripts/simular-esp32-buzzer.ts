/**
 * Simulador del ESP32 del buzzer.
 *
 * Reproduce EXACTAMENTE lo que hace `docs/node-red/esp32-buzzer-http.ino`,
 * pero desde Node, para poder probar el circuito sin hardware.
 *
 *   Uso: npx tsx scripts/simular-esp32-buzzer.ts <API_KEY>
 *
 * Qué hace:
 *   1. Pregunta cada 2 s por sus comandos pendientes.
 *   2. Al recibir uno, "acciona" el buzzer (lo imprime en pantalla).
 *   3. Confirma la ejecución a la API.
 */
const API = 'http://localhost:4000/api/v1';
const API_KEY = process.argv[2];
const DISPOSITIVO = 'ESP32-BUZZER';
const ACTUADOR = 'BUZZER-1';

if (!API_KEY) {
  console.error('Falta la API Key. Uso: npx tsx scripts/simular-esp32-buzzer.ts <API_KEY>');
  process.exit(1);
}

/** Estado del buzzer, igual que la variable del sketch. */
let encendido = false;
let vueltas = 0;

async function consultarComandos(): Promise<void> {
  const url = `${API}/iot/comandos/pendientes?identificador=${DISPOSITIVO}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
  } catch {
    console.log('  [API] sin conexión');
    return;
  }

  if (!respuesta.ok) {
    console.log(`  [API] HTTP ${respuesta.status}`);
    if (respuesta.status === 401) console.log('        API Key incorrecta');
    return;
  }

  const cuerpo = (await respuesta.json()) as {
    datos: Array<{ id: string; comando: string; actuador_codigo: string }>;
  };
  const comandos = cuerpo.datos ?? [];

  if (comandos.length > 0) {
    console.log(`\n  >> ${comandos.length} comando(s) recibido(s)`);
  }

  for (const cmd of comandos) {
    if (cmd.actuador_codigo !== ACTUADOR) {
      console.log(`     ignorado (es para ${cmd.actuador_codigo})`);
      continue;
    }

    // "Accionar el buzzer"
    const comando = cmd.comando.toUpperCase();
    encendido = comando === 'ON' || comando === '1' || comando === 'TRUE';
    console.log(`     BUZZER ${encendido ? '🔊 ENCENDIDO' : '🔇 APAGADO'}`);

    // Confirmar a la API
    const r = await fetch(`${API}/iot/comandos/${cmd.id}`, {
      method: 'PATCH',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'ejecutado',
        estado_actuador: encendido ? 'on' : 'off',
        respuesta: { origen: 'simulador-esp32', rssi: -55 },
      }),
    });
    console.log(`     confirmado -> HTTP ${r.status}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Simulador ESP32 (buzzer) ===');
  console.log(`Dispositivo: ${DISPOSITIVO}`);
  console.log(`Actuador   : ${ACTUADOR}`);
  console.log('Preguntando cada 2 s. Ctrl+C para salir.\n');

  setInterval(() => {
    vueltas++;
    void consultarComandos();
  }, 2000);

  // Una primera consulta inmediata.
  await consultarComandos();
}

void main();
