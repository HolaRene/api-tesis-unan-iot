#!/usr/bin/env node
/**
 * Prueba de latencia de comandos.
 *
 * Envía N comandos a un actuador con latencia simulada y devuelve una tabla
 * con la latencia de cada uno y el desglose por etapa.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/prueba-comandos.mjs \
 *     --actuador MOTOR-EXTRACTOR-2 \
 *     --n 10 \
 *     --intervalo 3 \
 *     --salida latencias.csv
 *
 * Requiere las mismas variables que la API:
 *   API_URL   (por defecto http://localhost:4000/api/v1)
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ HACE
 * ──────────────────────────────────────────────────────────────────────
 *   1. Inicia sesión como administrador.
 *   2. Envía N comandos alternando ON/OFF.
 *   3. Espera a que Node-RED los procese (consulta su estado).
 *   4. Imprime una tabla y, si se pide, escribe un CSV para la tesis.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ ALTERNA ON/OFF
 * ──────────────────────────────────────────────────────────────────────
 * Enviar diez veces ON seguidos mide algo distinto: a partir del segundo, el
 * equipo ya está en ON y el PLC no tarda en confirmarlo. Alternando se mide
 * el retardo real de cada transición.
 */
import { writeFile } from 'node:fs/promises';

const API = process.env.API_URL || 'http://localhost:4000/api/v1';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@monitoreo.local';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345';

// ── Argumentos ──
const args = process.argv.slice(2);
const arg = (nombre, defecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : defecto;
};

const codigoActuador = arg('actuador', null);
const cantidad = Number(arg('n', '10'));
const intervalo = Number(arg('intervalo', '3'));
const archivoSalida = arg('salida', null);

if (!codigoActuador) {
  console.error(
    'Uso: node scripts/prueba-comandos.mjs --actuador CODIGO [--n 10] [--intervalo 3] [--salida latencias.csv]'
  );
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(ruta, opciones = {}) {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      `${r.status} ${cuerpo.mensaje || r.statusText} en ${ruta}`
    );
  }
  return cuerpo;
}

function segundos(a, b) {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000;
}

const formato = (v) => (v === null ? '—' : v.toFixed(3));

async function principal() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' PRUEBA DE LATENCIA DE COMANDOS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  API:        ${API}`);
  console.log(`  Actuador:   ${codigoActuador}`);
  console.log(`  Comandos:   ${cantidad}`);
  console.log(`  Intervalo:  ${intervalo} s`);
  console.log('');

  // 1. Sesión
  const login = await api('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.datos.token;
  const auth = { Authorization: `Bearer ${token}` };

  // 2. Localizar el actuador
  const actuadores = (await api('/actuadores', { headers: auth })).datos;
  const actuador = actuadores.find((a) => a.codigo === codigoActuador);
  if (!actuador) {
    const disponibles = actuadores.map((a) => a.codigo).join(', ');
    throw new Error(
      `No existe el actuador '${codigoActuador}'. Disponibles: ${disponibles}`
    );
  }

  const latenciaConfig = actuador.configuracion?.latencia_s ?? 0;
  console.log(
    `  Latencia configurada en el actuador: ${latenciaConfig} s\n`
  );

  // 3. Enviar comandos alternando ON/OFF
  const enviados = [];
  for (let i = 0; i < cantidad; i += 1) {
    const comando = i % 2 === 0 ? 'ON' : 'OFF';
    const t0 = Date.now();
    const r = await api(`/actuadores/${actuador.id}/comandos`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ comando }),
    });
    enviados.push({
      n: i + 1,
      comando,
      id: r.datos.id ?? r.datos.comando_id,
      enviado_desde_cliente: new Date(t0).toISOString(),
    });
    process.stdout.write(`\r  Enviando ${i + 1}/${cantidad}…`);
    if (i < cantidad - 1) await dormir(intervalo * 1000);
  }
  console.log('\n');

  // 4. Esperar a que se resuelvan
  const tiempoMaximo = (latenciaConfig + 30) * 1000;
  const inicioEspera = Date.now();
  let pendientes = enviados.length;

  process.stdout.write('  Esperando confirmaciones ');
  while (pendientes > 0 && Date.now() - inicioEspera < tiempoMaximo) {
    await dormir(1000);
    /*
     * La API no expone GET de un comando suelto: se lista los del actuador
     * y se buscan los nuestros por id.
     */
    const lista = (
      await api(`/actuadores/${actuador.id}/comandos?limite=50`, {
        headers: auth,
      })
    ).datos;

    const porId = new Map(lista.map((c) => [String(c.id), c]));
    for (const e of enviados) {
      const c = porId.get(String(e.id));
      if (c) e.estado = c;
    }

    pendientes = enviados.filter(
      (e) =>
        !e.estado ||
        e.estado.estado === 'pendiente' ||
        e.estado.estado === 'enviado'
    ).length;
    process.stdout.write('.');
  }
  console.log('\n');

  // 5. Tabla
  const filas = enviados.map((e) => {
    const c = e.estado || {};
    return {
      n: e.n,
      comando: e.comando,
      estado: c.estado ?? 'desconocido',
      total_s: segundos(c.creado_en, c.ejecutado_en),
      recogida_s: segundos(c.creado_en, c.recogido_en),
      aplicacion_s: segundos(c.enviado_en, c.confirmado_en),
      api_s: segundos(c.confirmado_en, c.ejecutado_en),
      motivo: c.respuesta?.motivo ?? '—',
    };
  });

  console.log('  ┌────┬─────────┬───────────┬─────────┬──────────┬────────────┬─────────┐');
  console.log('  │  # │ comando │ estado    │ total s │ recog. s │ aplicac. s │ api s   │');
  console.log('  ├────┼─────────┼───────────┼─────────┼──────────┼────────────┼─────────┤');
  for (const f of filas) {
    console.log(
      `  │ ${String(f.n).padStart(2)} │ ${f.comando.padEnd(7)} │ ${f.estado.padEnd(9)} │ ${formato(f.total_s).padStart(7)} │ ${formato(f.recogida_s).padStart(8)} │ ${formato(f.aplicacion_s).padStart(10)} │ ${formato(f.api_s).padStart(7)} │`
    );
  }
  console.log('  └────┴─────────┴───────────┴─────────┴──────────┴────────────┴─────────┘');

  // 6. Resumen
  const totales = filas.map((f) => f.total_s).filter((v) => v !== null);
  const exitosos = filas.filter((f) => f.estado === 'ejecutado').length;

  if (totales.length > 0) {
    const ordenados = [...totales].sort((a, b) => a - b);
    const suma = totales.reduce((a, b) => a + b, 0);
    const p95 =
      ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))];

    console.log('');
    console.log(`  Ejecutados: ${exitosos}/${filas.length}`);
    console.log(`  Latencia mínima:   ${formato(Math.min(...totales))} s`);
    console.log(`  Latencia promedio: ${formato(suma / totales.length)} s`);
    console.log(`  Latencia p95:      ${formato(p95)} s`);
    console.log(`  Latencia máxima:   ${formato(Math.max(...totales))} s`);
  }

  // 7. CSV para la tesis
  if (archivoSalida) {
    const cabecera = 'n,comando,estado,total_s,recogida_s,aplicacion_s,api_s,motivo';
    const cuerpo = filas
      .map(
        (f) =>
          `${f.n},${f.comando},${f.estado},${f.total_s ?? ''},${f.recogida_s ?? ''},${f.aplicacion_s ?? ''},${f.api_s ?? ''},${f.motivo}`
      )
      .join('\n');
    await writeFile(archivoSalida, `${cabecera}\n${cuerpo}\n`, 'utf8');
    console.log(`\n  CSV guardado en ${archivoSalida}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

principal().catch((e) => {
  console.error(`\n  ERROR: ${e.message}\n`);
  process.exit(1);
});
