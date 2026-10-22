#!/usr/bin/env node
/**
 * Aplicador de migraciones SEGURO (con tabla de control).
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ──────────────────────────────────────────────────────────────────────
 * `pnpm migrate` re-ejecuta TODAS las migraciones en cada pasada, porque no
 * lleva registro de lo aplicado. Eso significa que cada vez vuelve a correr:
 *
 *   0009_canales.sql            → TRUNCATE de 11 tablas
 *   0010_tipos_variable_seed.sql → DELETE FROM tipos_variable
 *
 * y borra los datos sin avisar.
 *
 * Este script lleva una tabla `_migraciones_aplicadas` y ejecuta SOLO lo que
 * falta. Las migraciones ya aplicadas no se vuelven a tocar.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/migrar-seguro.mjs              # aplica lo pendiente
 *   node scripts/migrar-seguro.mjs --dry-run    # solo muestra qué haría
 *   node scripts/migrar-seguro.mjs --baseline   # marca todo lo existente
 *                                               # como aplicado (primera vez)
 *
 * ──────────────────────────────────────────────────────────────────────
 * PRIMERA VEZ EN UNA BASE QUE YA TIENE DATOS
 * ──────────────────────────────────────────────────────────────────────
 * Las migraciones antiguas ya se aplicaron a mano en algún momento, pero no
 * hay registro. Si se ejecutara todo desde cero, la 0009 borraría las tablas.
 *
 * Por eso la primera vez se usa `--baseline`: marca como aplicado todo lo
 * que la base YA tiene, sin ejecutar nada. A partir de ahí, solo se aplican
 * las nuevas.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SEGURIDAD
 * ──────────────────────────────────────────────────────────────────────
 *   - Cada migración va en su propia transacción: si falla, se revierte.
 *   - Se detectan sentencias destructivas (TRUNCATE, DELETE, DROP) y el
 *     script se niega a ejecutarlas salvo con `--permitir-destructivas`.
 *   - `--dry-run` no abre transacción.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_MIGRACIONES = path.resolve(__dirname, '../src/database/migrations');
const TABLA_CONTROL = '_migraciones_aplicadas';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BASELINE = args.includes('--baseline');
const PERMITIR_DESTRUCTIVAS = args.includes('--permitir-destructivas');

/**
 * Sentencias que destruyen datos.
 *
 * Se detectan ANTES de ejecutar. La 0009 y la 0010 las contienen, así que
 * este script se negaría a correrlas — que es justo lo que se quiere.
 */
const PATRONES_DESTRUCTIVOS = [
  { regex: /^\s*TRUNCATE\s/im, nombre: 'TRUNCATE' },
  { regex: /^\s*DELETE\s+FROM/im, nombre: 'DELETE' },
  { regex: /^\s*DROP\s+TABLE/im, nombre: 'DROP TABLE' },
  { regex: /^\s*DROP\s+SCHEMA/im, nombre: 'DROP SCHEMA' },
  { regex: /^\s*ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/im, nombre: 'DROP COLUMN' },
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
    break;
  }
}

function listarMigraciones() {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function analizarDestructivas(sql) {
  const encontradas = [];
  for (const { regex, nombre } of PATRONES_DESTRUCTIVOS) {
    if (regex.test(sql)) encontradas.push(nombre);
  }
  return encontradas;
}

async function principal() {
  cargarEnv();

  const cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error('  ERROR: falta DATABASE_URL en el entorno.');
    process.exit(1);
  }

  // Nunca mostrar la contraseña en el log.
  const urlSegura = cadena.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');

  console.log('═══════════════════════════════════════════════════════');
  console.log(' MIGRACIONES SEGURAS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Base de datos: ${urlSegura}`);
  console.log(`  Modo: ${BASELINE ? 'BASELINE (marcar existentes)' : DRY_RUN ? 'SIMULACIÓN' : 'APLICAR'}`);
  console.log('');

  const cliente = new Client({ connectionString: cadena });
  await cliente.connect();

  try {
    // 1. Crear la tabla de control si no existe.
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS ${TABLA_CONTROL} (
        archivo    VARCHAR(255) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duracion_ms INTEGER
      )
    `);

    // 2. ¿Qué hay aplicado?
    const aplicadas = new Set(
      (await cliente.query(`SELECT archivo FROM ${TABLA_CONTROL}`)).rows.map(
        (r) => r.archivo
      )
    );

    const todas = listarMigraciones();
    const pendientes = todas.filter((m) => !aplicadas.has(m));

    console.log(`  Migraciones en disco: ${todas.length}`);
    console.log(`  Ya aplicadas:         ${aplicadas.size}`);
    console.log(`  Pendientes:           ${pendientes.length}`);
    console.log('');

    // ── BASELINE ──
    if (BASELINE) {
      if (pendientes.length === 0) {
        console.log('  No hay nada que marcar.\n');
        return;
      }
      console.log('  Marcando como aplicadas (sin ejecutar):');
      for (const archivo of pendientes) {
        if (!DRY_RUN) {
          await cliente.query(
            `INSERT INTO ${TABLA_CONTROL} (archivo, duracion_ms)
             VALUES ($1, 0) ON CONFLICT (archivo) DO NOTHING`,
            [archivo]
          );
        }
        console.log(`    ✓ ${archivo}`);
      }
      console.log('');
      console.log('  Listo. A partir de ahora solo se aplicarán las nuevas.');
      console.log('  Verifica que la estructura es la correcta antes de seguir.');
      return;
    }

    // ── Sin pendientes ──
    if (pendientes.length === 0) {
      console.log('  No hay migraciones pendientes. Nada que hacer.\n');
      return;
    }

    // ── Analizar antes de ejecutar ──
    console.log('  Analizando las pendientes:');
    const destructivas = [];
    for (const archivo of pendientes) {
      const sql = readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8');
      const encontradas = analizarDestructivas(sql);
      if (encontradas.length > 0) {
        destructivas.push({ archivo, encontradas });
        console.log(`    ⚠ ${archivo} → ${encontradas.join(', ')}`);
      } else {
        console.log(`    ✓ ${archivo}`);
      }
    }
    console.log('');

    if (destructivas.length > 0 && !PERMITIR_DESTRUCTIVAS) {
      console.error('  ABORTADO: hay migraciones que borran datos.');
      console.error('');
      for (const d of destructivas) {
        console.error(`    ${d.archivo}: ${d.encontradas.join(', ')}`);
      }
      console.error('');
      console.error('  Opciones:');
      console.error('    1) Respalda la base y usa --permitir-destructivas');
      console.error('    2) Si esa migración YA se aplicó antes, marca la base con');
      console.error('       --baseline para que no vuelva a ejecutarse.');
      console.error('');
      process.exit(1);
    }

    if (DRY_RUN) {
      console.log('  (simulación: no se ha ejecutado nada)\n');
      return;
    }

    // ── Aplicar una a una ──
    for (const archivo of pendientes) {
      const sql = readFileSync(path.join(DIR_MIGRACIONES, archivo), 'utf8');
      const inicio = Date.now();

      process.stdout.write(`  Aplicando ${archivo}… `);
      try {
        await cliente.query('BEGIN');
        await cliente.query(sql);
        await cliente.query(
          `INSERT INTO ${TABLA_CONTROL} (archivo, duracion_ms)
           VALUES ($1, $2) ON CONFLICT (archivo) DO NOTHING`,
          [archivo, Date.now() - inicio]
        );
        await cliente.query('COMMIT');
        console.log(`OK (${Date.now() - inicio} ms)`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        console.log('FALLÓ');
        console.error(`\n  Error en ${archivo}:`);
        console.error(`    ${error instanceof Error ? error.message : error}\n`);
        console.error('  Se revirtió SOLO esa migración. La base queda como estaba.');
        process.exit(1);
      }
    }

    console.log('');
    console.log('  Todas las pendientes se aplicaron correctamente.');
    console.log('');
  } finally {
    await cliente.end();
  }
}

principal().catch((error) => {
  console.error(`\n  ERROR: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
