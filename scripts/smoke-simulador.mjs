/**
 * Prueba de humo del simulador: ejecuta el nodo de Node-RED varias veces y
 * envía los payloads REALES a la API, para confirmar que se ingieren.
 *
 * Crea una API Key temporal y la borra al terminar.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, closePool } from '../src/database/pool.js';

// El script vive en api/scripts/; el nodo está en la raíz del repo.
const RAIZ_REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const RUTA_NODO = path.join(RAIZ_REPO, 'docs/node-red/simulador-sensor.js');
const BASE = 'http://localhost:4000/api/v1';

const PREFIJO_CLAVE = 'flx_';
const SECRETO = crypto.randomBytes(24).toString('base64url');
const CLAVE = `${PREFIJO_CLAVE}${SECRETO}`;
const PREFIJO = `${PREFIJO_CLAVE}${SECRETO.slice(0, 8)}`;

const codigo = readFileSync(RUTA_NODO, 'utf8');

/** Entorno mínimo que imita a Node-RED. */
function crearEntorno() {
  const almacen = {};
  return {
    env: { get: () => CLAVE },
    context: { get: (k) => almacen[k], set: (k, v) => { almacen[k] = v; } },
    node: { status: () => {}, warn: () => {} },
    fabrica: new Function('env', 'context', 'node', 'msg', codigo),
  };
}

async function crearClaveTemporal() {
  const hash = await bcrypt.hash(CLAVE, 10);
  const u = await query('SELECT id FROM usuarios LIMIT 1');
  await query(
    `INSERT INTO claves_api (nombre, prefijo, hash_clave, usuario_id, activa, permisos)
     VALUES ($1,$2,$3,$4,true,$5)`,
    ['smoke-simulador', PREFIJO, hash, u.rows[0].id,
     JSON.stringify({ 'mediciones:crear': true, 'estado:actualizar': true })]
  );
}

async function enviar(payload) {
  const r = await fetch(`${BASE}/iot/mediciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': CLAVE },
    body: JSON.stringify(payload),
  });
  return { status: r.status, cuerpo: await r.json() };
}

/** Pausa para no generar todos los puntos en el mismo segundo. */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await crearClaveTemporal();
  console.log('API Key temporal creada.\n');

  const { env, context, node, fabrica } = crearEntorno();

  console.log('Enviando 6 lecturas simuladas a la API real (1 s entre cada una):\n');
  let procesadas = 0;
  let fallidas = 0;

  for (let i = 1; i <= 6; i++) {
    const salida = fabrica(env, context, node, { payload: '' });
    const { status, cuerpo } = await enviar(salida.payload);
    const m = salida.payload.mediciones;

    if (status === 201 && cuerpo.datos) {
      procesadas += cuerpo.datos.procesadas ?? 0;
      fallidas += cuerpo.datos.fallidas ?? 0;
    }

    console.log(
      `  ${i}) HTTP ${status} | ${String(m[0].valor).padStart(5)} C | ${String(m[1].valor).padStart(5)} % | procesadas=${cuerpo.datos?.procesadas ?? '?'} fallidas=${cuerpo.datos?.fallidas ?? '?'}`
    );
    if (i < 6) await esperar(1000);
  }

  console.log(`\nTotal: ${procesadas} procesadas, ${fallidas} fallidas`);

  // Verificación: ¿están en la base de datos?
  const conteo = await query(
    `SELECT count(*)::int AS n FROM mediciones
     WHERE registrado_en > now() - interval '5 minutes'
       AND metadatos->>'fuente' = 'simulador-node-red'`
  );
  console.log(`Mediciones del simulador en BD (últimos 5 min): ${conteo.rows[0].n}`);
  console.log(conteo.rows[0].n > 0 ? '\n✅ El flujo completo funciona.' : '\n❌ No se guardaron mediciones.');
} catch (error) {
  console.error('Error:', error);
} finally {
  await query('DELETE FROM claves_api WHERE nombre = $1', ['smoke-simulador']);
  console.log('API Key temporal eliminada.');
  await closePool();
}
