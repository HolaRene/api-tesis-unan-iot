/**
 * Instala el flujo del SIMULADOR en Node-RED, separado del flujo real.
 *
 * Hace tres cosas sobre ~/.node-red/flows.json:
 *   1. Restaura `f1` a su función original (reenviar lo que manda el ESP32).
 *   2. Añade un flujo NUEVO: inject (cada 5 s) → simulador → HTTP → debug.
 *   3. Deja intacto el resto del flujo.
 *
 * Uso: node scripts/instalar-flujo-simulador.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const DIR_NR = path.join(os.homedir(), '.node-red');
const FLUJOS = path.join(DIR_NR, 'flows.json');
const RAIZ_REPO = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..'
);
const CODIGO_SIMULADOR = readFileSync(
  path.join(RAIZ_REPO, 'docs/node-red/simulador-sensor.js'),
  'utf8'
);

if (!existsSync(FLUJOS)) {
  console.error(`No se encontró ${FLUJOS}. ¿Está Node-RED instalado?`);
  process.exit(1);
}

const id = (prefijo) => `${prefijo}${crypto.randomBytes(8).toString('hex')}`;

/** Función ORIGINAL de f1: reenvía tal cual lo que manda el ESP32. */
const CODIGO_REENVIO = `// Node-RED function node — TELEMETRÍA → /iot/mediciones
const d = (typeof msg.payload === 'string') ? JSON.parse(msg.payload) : msg.payload;

msg.headers = {
  "X-API-Key": env.get("NODE_RED_API_KEY") || "flx_2-XJlrJozQt_71KbkbGp6ygfyUwf",
  "Content-Type": "application/json"
};

// El ESP32 YA manda: { dispositivo, mediciones:[{canal, valor}] }
// Se reenvía tal cual (no se reinventa desde d.temp / d.hum).
msg.payload = {
  dispositivo: d.dispositivo,
  mediciones: d.mediciones
};

return msg;`;

const flujos = JSON.parse(readFileSync(FLUJOS, 'utf8'));

// ── 1) Restaurar f1 ───────────────────────────────────────────
const f1 = flujos.find((n) => n.id === 'f1');
if (f1) {
  f1.func = CODIGO_REENVIO;
  console.log('✔ f1 restaurada: vuelve a reenviar lo del ESP32.');
} else {
  console.log('· f1 no encontrada (¿ya la quitaste?).');
}

// ── 2) Flujo nuevo del simulador ──────────────────────────────
// Se reutiliza el http request existente (id "http"), que ya apunta a
// /iot/mediciones y está conectado al debug "Resp API".
const httpExistente = flujos.find((n) => n.id === 'http');
const debugExistente = flujos.find((n) => n.id === 'dbg');

if (!httpExistente) {
  console.error('No se encontró el nodo http request (id "http"). Aborta.');
  process.exit(1);
}

// Evitar duplicados si el script se ejecuta dos veces.
const yaInstalado = flujos.some((n) => n.name === 'SIMULADOR — sensor falso');
if (yaInstalado) {
  console.log('· El flujo del simulador ya estaba instalado. Solo se actualizó el código.');
  const nodoSim = flujos.find((n) => n.name === 'SIMULADOR — sensor falso');
  nodoSim.func = CODIGO_SIMULADOR;
} else {
  const tabSim = id('tabsim');
  const injectSim = id('inj');
  const funcSim = id('fsim');

  flujos.push({
    id: tabSim,
    type: 'tab',
    label: 'Simulador (sensor falso)',
    disabled: false,
    info: 'Genera telemetría aleatoria realista sin necesidad de hardware. Independiente del flujo del ESP32.',
  });

  flujos.push({
    id: injectSim,
    type: 'inject',
    z: tabSim,
    name: 'cada 15 s',
    props: [{ p: 'payload' }],
    repeat: '15',
    crontab: '',
    once: false,
    onceDelay: 0.1,
    topic: '',
    payload: '',
    payloadType: 'str',
    x: 150,
    y: 100,
    wires: [[funcSim]],
  });

  flujos.push({
    id: funcSim,
    type: 'function',
    z: tabSim,
    name: 'SIMULADOR — sensor falso',
    func: CODIGO_SIMULADOR,
    outputs: 1,
    timeout: 0,
    noerr: 0,
    initialize: '',
    finalize: '',
    libs: [],
    x: 400,
    y: 100,
    wires: [['http']],
  });

  // El nodo http se comparte entre las dos pestañas: Node-RED lo permite y
  // evita duplicar la configuración de la URL y las cabeceras.
  if (httpExistente.z) {
    console.log(`· El http request pertenece a la pestaña ${httpExistente.z}; se reutiliza tal cual.`);
  }

  console.log('✔ Flujo del simulador añadido (pestaña "Simulador (sensor falso)").');
}

// ── 3) Guardar ────────────────────────────────────────────────
copyFileSync(FLUJOS, `${FLUJOS}.bak`);
writeFileSync(FLUJOS, JSON.stringify(flujos, null, 4));
console.log(`✔ Guardado ${FLUJOS} (copia en flows.json.bak)`);
if (debugExistente) {
  console.log(`· El debug "${debugExistente.name}" recibirá también las respuestas del simulador.`);
}

// ── 4) Aviso: Node-RED debe recargar el archivo ───────────────
// Node-RED carga flows.json en memoria al arrancar. Si está corriendo
// mientras se modifica el archivo, seguirá mostrando la versión ANTIGUA (y
// al guardar desde la interfaz sobrescribirá este cambio).
const nrCorriendo = (() => {
  try {
    const salida = execSync('pgrep -f "^node-red$" || pgrep -f "node-red "', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return salida.length > 0;
  } catch {
    return false; // pgrep devuelve código 1 cuando no encuentra nada
  }
})();

console.log('');
if (nrCorriendo) {
  console.warn('⚠️  Node-RED ESTÁ CORRIENDO.');
  console.warn('   El archivo ya está actualizado en disco, pero Node-RED sigue');
  console.warn('   usando la versión que cargó en memoria al arrancar:');
  console.warn('   NO verás el flujo nuevo hasta que reinicies.');
  console.warn('');
  console.warn('   Además, si guardas algo desde la interfaz, Node-RED');
  console.warn('   SOBRESCRIBIRÁ este cambio con su versión antigua.');
  console.warn('');
  console.warn('   → Reinicia Node-RED (Ctrl+C en su terminal y `node-red`).');
} else {
  console.log('✔ Node-RED no está corriendo: al arrancarlo cargará el flujo nuevo.');
}
