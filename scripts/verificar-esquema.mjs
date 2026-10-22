#!/usr/bin/env node
/**
 * Comprueba si el ESQUEMA de la base coincide con lo que espera el código.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ──────────────────────────────────────────────────────────────────────
 * El code pasa a usar columnas nuevas (`areas.perfil_alerta`,
 * `reglas_alerta.histeresis`…) mientras la base no las tiene. El resultado
 * no es un error al arrancar, sino uno en tiempo de ejecución:
 *
 *     error: no existe la columna «perfil_alerta» en la relación «areas»
 *
 * Se descubre al crear un área, no antes. Este script lo detecta en 2
 * segundos y dice exactamente qué falta y qué archivo lo aporta.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/verificar-esquema.mjs
 *
 * Solo LEE el esquema: no modifica nada.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lo que el código espera, con la migración que lo aporta.
 *
 * Si añades una columna en una migración nueva, añádela aquí también: esta
 * lista es la que convierte un fallo en producción en un aviso previo.
 */
const ESPERADO = [
  // 0013 — aislamiento por usuario
  { tabla: 'areas', columna: 'propietario_id', migracion: '0013' },
  { tabla: 'dispositivos', columna: 'propietario_id', migracion: '0013' },

  // 0014 — cámaras IP
  { tabla: 'camaras', columna: 'ruta_webrtc', migracion: '0014' },
  { tabla: 'camaras', columna: 'estado', migracion: '0014' },
  { tabla: 'camaras', columna: 'propietario_id', migracion: '0014' },

  // 0015 — comandos de actuador
  { tabla: 'actuadores', columna: 'topico_mqtt', migracion: '0015' },
  { tabla: 'actuadores', columna: 'ultima_orden_en', migracion: '0015' },

  // 0016 — direccionamiento
  { tabla: 'actuadores', columna: 'protocolo', migracion: '0016' },

  // 0017 — motor de alertas
  { tabla: 'reglas_alerta', columna: 'histeresis', migracion: '0017' },
  { tabla: 'alertas_retardo', columna: null, migracion: '0017' },

  // 0018 — perfil normativo y trazabilidad
  { tabla: 'areas', columna: 'perfil_alerta', migracion: '0018' },
  { tabla: 'reglas_alerta', columna: 'plantilla_id', migracion: '0018' },
  { tabla: 'reglas_alerta', columna: 'norma', migracion: '0018' },
  { tabla: 'reglas_alerta', columna: 'requiere_verificacion', migracion: '0018' },

  // 0019 — latencias
  { tabla: 'comandos_actuador', columna: 'recogido_en', migracion: '0019' },
  { tabla: 'comandos_actuador', columna: 'confirmado_en', migracion: '0019' },
];

function cargarEnv() {
  for (const archivo of ['.env.development', '.env']) {
    const ruta = path.resolve(__dirname, '..', archivo);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const i = limpia.indexOf('=');
      if (i === -1) continue;
      const clave = limpia.slice(0, i).trim();
      let valor = limpia.slice(i + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      if (!process.env[clave]) process.env[clave] = valor;
    }
  }
}

async function principal() {
  cargarEnv();

  const cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error('  ERROR: falta DATABASE_URL.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(' VERIFICACIÓN DEL ESQUEMA');
  console.log('═══════════════════════════════════════════════════════');
  console.log(
    `  Base: ${cadena.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')}`
  );
  console.log('');

  const cliente = new Client({ connectionString: cadena });
  await cliente.connect();

  try {
    // Tablas y columnas existentes.
    const { rows: tablas } = await cliente.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
    );
    const nombresTablas = new Set(tablas.map((t) => t.table_name));

    const { rows: columnas } = await cliente.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`
    );
    const conjuntoColumnas = new Set(
      columnas.map((c) => `${c.table_name}.${c.column_name}`)
    );

    const faltantes = [];

    for (const e of ESPERADO) {
      if (e.columna === null) {
        if (!nombresTablas.has(e.tabla)) faltantes.push(e);
      } else if (!conjuntoColumnas.has(`${e.tabla}.${e.columna}`)) {
        faltantes.push(e);
      }
    }

    if (faltantes.length === 0) {
      console.log(`  ✓ Todo correcto: ${ESPERADO.length} elementos verificados.`);
      console.log('');
      return;
    }

    console.error(`  ✗ FALTAN ${faltantes.length} de ${ESPERADO.length}:`);
    console.error('');
    for (const f of faltantes) {
      const que = f.columna ? `${f.tabla}.${f.columna}` : `tabla ${f.tabla}`;
      console.error(`     - ${que.padEnd(38)} (migración ${f.migracion})`);
    }

    // Migraciones únicas, en orden.
    const necesarias = [...new Set(faltantes.map((f) => f.migracion))].sort();
    console.error('');
    console.error('  Ejecuta, en orden:');
    console.error('');
    for (const m of necesarias) {
      console.error(
        `     psql "$DATABASE_URL" -f src/database/migrations/${m}_*.sql`
      );
    }
    console.error('');
    process.exit(1);
  } finally {
    await cliente.end();
  }
}

principal().catch((e) => {
  console.error(`\n  ERROR: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
