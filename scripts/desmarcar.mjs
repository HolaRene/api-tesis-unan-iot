#!/usr/bin/env node
/**
 * Deshace un baseline hecho en la base equivocada.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CUÁNDO HACE FALTA
 * ──────────────────────────────────────────────────────────────────────
 * Si `pnpm migrate:baseline` se ejecutó con `DATABASE_URL` apuntando a
 * `postgres` (la base administrativa) en lugar de a la base del proyecto,
 * esa base quedó con una tabla `_migraciones_aplicadas` que dice que las 19
 * migraciones están puestas, cuando en realidad no lo están.
 *
 * Este script borra SOLO esa tabla. No toca ninguna tabla de datos.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/desmarcar.mjs            # la base de DATABASE_URL
 *   node scripts/desmarcar.mjs --base postgres   # otra base concreta
 *
 * No requiere `psql`.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLA_CONTROL = '_migraciones_aplicadas';

const args = process.argv.slice(2);
const indiceBase = args.indexOf('--base');
const BASE_OBJETIVO = indiceBase !== -1 ? args[indiceBase + 1] : null;

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

  let cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error('  ERROR: falta DATABASE_URL.');
    process.exit(1);
  }

  // Cambiar la base destino si se pidió otra.
  if (BASE_OBJETIVO) {
    cadena = cadena.replace(/\/[^/?]+(\?.*)?$/, `/${BASE_OBJETIVO}`);
  }

  const nombreBase = cadena.split('/').pop()?.split('?')[0] ?? '?';

  console.log('═══════════════════════════════════════════════════════');
  console.log(' DESMARCAR MIGRACIONES');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Base: ${nombreBase}`);
  console.log('');

  const cliente = new Client({ connectionString: cadena });
  await cliente.connect();

  try {
    const existe = await cliente.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name=$1`,
      [TABLA_CONTROL]
    );

    if (existe.rowCount === 0) {
      console.log(`  No existe ${TABLA_CONTROL} en esta base. Nada que hacer.`);
      console.log('');
      return;
    }

    // Se informa de cuántas había, para que quede constancia.
    const { rows } = await cliente.query(
      `SELECT count(*)::int AS n FROM ${TABLA_CONTROL}`
    );
    console.log(`  Marcadas como aplicadas: ${rows[0].n}`);
    console.log('');

    await cliente.query(`DROP TABLE ${TABLA_CONTROL}`);

    console.log(`  ✓ Tabla ${TABLA_CONTROL} eliminada.`);
    console.log('  No se ha tocado ninguna tabla de datos.');
    console.log('');
  } finally {
    await cliente.end();
  }
}

principal().catch((e) => {
  console.error(`\n  ERROR: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
