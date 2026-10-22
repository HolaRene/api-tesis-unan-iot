#!/usr/bin/env node
/**
 * Restaura un respaldo `.sql` sin necesidad de `psql`.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ──────────────────────────────────────────────────────────────────────
 * En Windows, `psql` a menudo no está en el PATH aunque PostgreSQL esté
 * instalado. Restaurar un respaldo no debería depender de tener el cliente
 * de línea de comandos localizable.
 *
 * Este script usa el driver `pg`, el mismo que la API.
 *
 * ⚠️  PELIGRO: restaurar SOBRESCRIBE la base. Todo lo creado después del
 * respaldo se pierde. El script pide confirmación explícita.
 *
 * ──────────────────────────────────────────────────────────────────────
 * USO
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/restaurar.mjs respaldos/monitoreo_iot_tesis_2026-10-21.sql
 *
 * Pide escribir `CONFIRMAR` para continuar.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/** Escapa un valor de texto en formato COPY para SQL con comillas simples. */
function escaparSql(valor) {
  if (valor === '\\N') return 'NULL';
  // Las secuencias de escape de COPY son las mismas que las de SQL simple
  // salvo por \\t y \\n, que PostgreSQL acepta igual dentro de una cadena.
  return `'${valor.replace(/'/g, "''")}'`;
}

/**
 * Convierte los bloques `COPY ... FROM stdin` del dump en INSERT.
 *
 * Una línea de datos de COPY es:
 *
 *     23288  |  \N  |  23.5  |  2026-10-21 12:00:00+00
 *
 * (sin espacios; aquí se ven separadas por conveniencia). Los campos van
 * separados por TAB y `\N` significa NULL.
 */
function convertirCopyAInsert(texto) {
  const lineas = texto.split('\n');
  const salida = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const esCopy = /^COPY\s+(.+?)\s+\((.*?)\)\s+FROM\s+stdin;/i.exec(linea);

    if (!esCopy) {
      salida.push(linea);
      i += 1;
      continue;
    }

    const tabla = esCopy[1];
    const columnas = esCopy[2];
    i += 1;

    // Recoger las filas hasta la marca \.
    const filas = [];
    while (i < lineas.length && lineas[i] !== '\\.') {
      const cruda = lineas[i];
      if (cruda.length > 0) {
        const campos = cruda.split('\t').map(escaparSql);
        filas.push(`(${campos.join(', ')})`);
      }
      i += 1;
    }
    i += 1; // saltar el \.

    if (filas.length === 0) continue;

    // Insertar por lotes de 200 para no generar sentencias gigantes.
    const TAMANO_LOTE = 200;
    for (let j = 0; j < filas.length; j += TAMANO_LOTE) {
      const lote = filas.slice(j, j + TAMANO_LOTE);
      salida.push(
        `INSERT INTO ${tabla} (${columnas}) VALUES\n${lote.join(',\n')};`
      );
    }
  }

  return salida.join('\n');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const archivo = process.argv[2];

  if (!archivo) {
    console.error('  Uso: node scripts/restaurar.mjs <archivo.sql>');
    process.exit(1);
  }

  const ruta = path.resolve(archivo);
  if (!existsSync(ruta)) {
    console.error(`  ERROR: no existe el archivo ${ruta}`);
    process.exit(1);
  }

  cargarEnv();
  const cadena = process.env.DATABASE_URL;
  if (!cadena) {
    console.error('  ERROR: falta DATABASE_URL.');
    process.exit(1);
  }

  const nombreBase = cadena.split('/').pop()?.split('?')[0] ?? '?';

  /*
   * `pg_dump` de PostgreSQL 16+ añade meta-comandos de `psql` al principio y
   * al final (`\restrict` y `\unrestrict`) para evitar que se inyecte SQL
   * en la salida. NO son SQL: el driver `pg` los rechaza con
   * «syntax error at or near \"\\\"».
   *
   * Se eliminan esas líneas. No afectan al contenido de los datos.
   */
  /*
   * Se eliminan las líneas que son meta-comandos de `psql`, no SQL:
   *
   *   \restrict / \unrestrict  → PostgreSQL 16+ las añade por seguridad
   *   \.                       → cierra cada bloque COPY
   *
   * `pg` las rechaza con «syntax error at or near "\"». Quitarlas no altera
   * los datos: `COPY ... FROM stdin` ya sabe dónde termina por el tamaño de
   * las columnas.
   */
  /*
   * `pg_dump` genera los datos como `COPY tabla (...) FROM stdin` seguido de
   * líneas separadas por tabuladores. Es un formato que SOLO entiende el
   * protocolo COPY de PostgreSQL, y el driver `pg` no lo soporta a través de
   * `query()`.
   *
   * Se convierte cada bloque COPY en INSERTs equivalentes. Es más lento, pero
   * funciona en cualquier sistema sin depender de `psql`.
   */
  const sql = convertirCopyAInsert(
    readFileSync(ruta, 'utf8')
      .split('\n')
      .filter(
        (linea) =>
          !linea.startsWith('\\restrict') && !linea.startsWith('\\unrestrict')
      )
      .join('\n')
  );

  console.log('═══════════════════════════════════════════════════════');
  console.log(' RESTAURAR RESPALDO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Archivo: ${path.basename(ruta)}`);
  console.log(`  Base:    ${nombreBase}`);
  console.log('');
  console.log('  ⚠️  Esto SOBRESCRIBE la base. Todo lo creado después del');
  console.log('      respaldo se perderá.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const respuesta = await rl.question('  Escribe CONFIRMAR para continuar: ');
  rl.close();

  if (respuesta.trim().toUpperCase() !== 'CONFIRMAR') {
    console.log('\n  Cancelado. No se ha tocado nada.\n');
    return;
  }

  const cliente = new Client({ connectionString: cadena });
  await cliente.connect();

  try {
    console.log('\n  Restaurando…');
    /*
     * El dump de `pg_dump` trae sus propias sentencias de control de
     * transacción y `SET`. Se ejecuta entero en una sola llamada.
     */
    await cliente.query(sql);
    console.log('  ✓ Restauración completada.');
    console.log('');
  } catch (error) {
    console.error('\n  ERROR al restaurar:');
    console.error(`    ${error instanceof Error ? error.message : error}`);
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
