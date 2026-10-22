#!/usr/bin/env node
/**
 * Ejecutor de tests multiplataforma.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ NO SIRVE `node --test "src/**\/*.test.ts"`
 * ──────────────────────────────────────────────────────────────────────
 * El comando anterior era:
 *
 *   "test": "node --import tsx --test \"src/** / *.test.ts\""
 *
 * El `**` lo expande la SHELL antes de llegar a Node. En bash funciona; en
 * `cmd.exe` y PowerShell **no se expande**, y Node recibe la cadena literal
 * `src/** /*.test.ts`, que no coincide con ningún archivo. El resultado en
 * Windows sería «0 tests ejecutados»: peor que un fallo, porque parece que
 * todo pasa.
 *
 * Aquí la búsqueda la hace Node con `readdirSync`, que funciona igual en
 * todos los sistemas operativos.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'src');

/** Recorre `src/` y devuelve todos los archivos `*.test.ts`. */
function buscarTests(directorio) {
  const encontrados = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...buscarTests(ruta));
    } else if (entrada.name.endsWith('.test.ts')) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

const archivos = buscarTests(ORIGEN).sort();

if (archivos.length === 0) {
  console.error('[test] No se encontró ningún archivo *.test.ts');
  process.exit(1);
}

console.log(`[test] Ejecutando ${archivos.length} archivo(s) de prueba…`);

try {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', '--test', ...archivos],
    { cwd: RAIZ, stdio: 'inherit' }
  );
} catch {
  // El runner de Node ya ha impreso el detalle del fallo.
  process.exit(1);
}
