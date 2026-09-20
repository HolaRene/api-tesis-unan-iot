/**
 * Diagnóstico temporal: crea una API Key de prueba y envía el payload del
 * usuario por HTTP para ver la respuesta real de la API.
 */
import { query, closePool } from '../src/database/pool.js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:4000/api/v1';

const PREFIJO_CLAVE = 'flx_';
const SECRETO = crypto.randomBytes(24).toString('base64url');
const CLAVE = `${PREFIJO_CLAVE}${SECRETO}`;
// El prefijo guardado es flx_ + los primeros 8 caracteres del secreto.
const PREFIJO = `${PREFIJO_CLAVE}${SECRETO.slice(0, 8)}`;

async function crearClave() {
  const hash = await bcrypt.hash(CLAVE, 10);
  const usuario = await query('SELECT id FROM usuarios LIMIT 1');
  await query(
    `INSERT INTO claves_api (nombre, prefijo, hash_clave, usuario_id, activa, permisos)
     VALUES ($1,$2,$3,$4,true,$5)`,
    [
      'diagnostico-temporal',
      PREFIJO,
      hash,
      usuario.rows[0].id,
      JSON.stringify({ 'mediciones:crear': true }),
    ]
  );
  console.log('Clave temporal creada:', PREFIJO + '...');
}

async function enviar(nombre, cuerpo) {
  const r = await fetch(`${BASE}/iot/mediciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': CLAVE },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  console.log(`\n--- ${nombre} ---`);
  console.log('HTTP', r.status, texto.slice(0, 400));
}

async function limpiar() {
  await query('DELETE FROM claves_api WHERE nombre = $1', ['diagnostico-temporal']);
  console.log('\nClave temporal eliminada.');
}

try {
  await crearClave();

  // 1) El payload EXACTO que el usuario dice que envía
  await enviar('1) Payload exacto del usuario (números reales)', {
    dispositivo: 'ESP32W',
    mediciones: [
      { canal: 'DHT1W-TEMPERATURA', valor: 24.8 },
      { canal: 'DHT1W-HUMEDAD_RELATIVA', valor: 68 },
    ],
  });

  // 2) Simulación de lo que hace Node-RED si la lectura falla (NaN → null)
  await enviar('2) Primer valor null (NaN serializado)', {
    dispositivo: 'ESP32W',
    mediciones: [
      { canal: 'DHT1W-TEMPERATURA', valor: null },
      { canal: 'DHT1W-HUMEDAD_RELATIVA', valor: 68 },
    ],
  });

  // 3) Simulación de la clave ausente (undefined se omite al serializar)
  await enviar('3) Primer valor ausente (clave omitida)', {
    dispositivo: 'ESP32W',
    mediciones: [
      { canal: 'DHT1W-TEMPERATURA' },
      { canal: 'DHT1W-HUMEDAD_RELATIVA', valor: 68 },
    ],
  });

  // 4) Valores como string (otro caso típico de MQTT)
  await enviar('4) Valores como string', {
    dispositivo: 'ESP32W',
    mediciones: [
      { canal: 'DHT1W-TEMPERATURA', valor: '24.8' },
      { canal: 'DHT1W-HUMEDAD_RELATIVA', valor: '68' },
    ],
  });
} finally {
  await limpiar();
  await closePool();
}
