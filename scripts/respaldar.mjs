#!/usr/bin/env node
/**
 * Respaldo rápido de la base de datos.
 *
 * Antes de aplicar cualquier migración conviene tener una copia. Este script
 * usa `pg_dump` (incluido con PostgreSQL) y guarda un archivo en `respaldos/`.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/respaldar.mjs
 *
 * Genera:  respaldos/monitoreo_iot_tesis_2026-10-22_14-30-00.sql
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SOLO "pg_dump > archivo"
 * ──────────────────────────────────────────────────────────────────────
 *   - Lee DATABASE_URL del .env, sin exponer la contraseña en el historial
 *     de la terminal.
 *   - Comprueba que el archivo resultante NO esté vacío antes de decir que
 *     todo ha ido bien. Un respaldo de 0 bytes da una falsa seguridad.
 *   - Informa del tamaño y de cómo restaurarlo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_RESPALDOS = path.resolve(__dirname, '../respaldos');

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


/**
 * Localiza `pg_dump`.
 *
 * En Linux suele estar en el PATH. En Windows es habitual que NO esté, aunque
 * PostgreSQL sí esté instalado: el instalador no añade `bin/` al PATH salvo
 * que se marque la casilla. Buscarlo en las rutas habituales evita el error
 * «pg_dump no se reconoce como un comando».
 */
function buscarPgDump() {
  // 1) En el PATH (funciona en Linux/macOS y en Windows si se añadió).
  const candidatos =
    process.platform === 'win32'
      ? ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']
      : [];

  try {
    execFileSync(
      process.platform === 'win32' ? 'where' : 'which',
      ['pg_dump'],
      { stdio: 'ignore' }
    );
    return 'pg_dump';
  } catch {
    // No está en el PATH: se busca en las instalaciones típicas.
  }

  // 2) Rutas de instalación de Windows, de la versión más nueva a la más vieja.
  for (const base of candidatos) {
    if (!existsSync(base)) continue;
    const versiones = readdirSync(base).sort().reverse();
    for (const v of versiones) {
      const exe = path.join(base, v, 'bin', 'pg_dump.exe');
      if (existsSync(exe)) return exe;
    }
  }

  return null;
}

function marcaDeTiempo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function principal() {
  cargarEnv();

  const cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error('  ERROR: falta DATABASE_URL.');
    process.exit(1);
  }

  const nombreBase = cadena.split('/').pop()?.split('?')[0] ?? 'base';
  const archivo = path.join(
    DIR_RESPALDOS,
    `${nombreBase}_${marcaDeTiempo()}.sql`
  );

  if (!existsSync(DIR_RESPALDOS)) mkdirSync(DIR_RESPALDOS, { recursive: true });

  console.log('═══════════════════════════════════════════════════════');
  console.log(' RESPALDO DE LA BASE DE DATOS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Destino: ${archivo}`);
  console.log('');

  const pgDump = buscarPgDump();
  if (!pgDump) {
    console.error('  ERROR: no se encontró pg_dump.');
    console.error('');
    if (process.platform === 'win32') {
      console.error('  En Windows suele estar en:');
      console.error('    C:\\Program Files\\PostgreSQL\\<version>\\bin\\pg_dump.exe');
      console.error('');
      console.error('  Opciones:');
      console.error('    1) Añadir esa carpeta al PATH y reabrir la terminal');
      console.error('    2) Hacer la copia con pgAdmin (clic derecho → Backup)');
    }
    process.exit(1);
  }

  try {
    execFileSync(
      pgDump,
      [cadena, '--no-owner', '--no-acl', '--file', archivo],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
  } catch (error) {
    const detalle = error.stderr ? error.stderr.toString() : String(error);
    console.error('  ERROR al ejecutar pg_dump:');
    console.error(`    ${detalle.trim()}`);
    console.error('');
    console.error('  ¿Está pg_dump instalado y en el PATH?');
    process.exit(1);
  }

  /* Un archivo vacío o diminuto NO es un respaldo: se comprueba antes de
     dar el visto bueno, porque lo contrario produce falsa seguridad. */
  const tamano = statSync(archivo).size;
  if (tamano < 1024) {
    console.error(`  El respaldo parece vacío (${tamano} bytes). Revisa el error.`);
    process.exit(1);
  }

  console.log(`  ✓ Respaldo completado: ${(tamano / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('  Para restaurarlo:');
  console.log(`    psql "$DATABASE_URL" -f "${archivo}"`);
  console.log('');
}

principal();
