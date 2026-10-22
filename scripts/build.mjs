#!/usr/bin/env node
/**
 * Build multiplataforma.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ NO ES UN SCRIPT DE UNA LÍNEA EN package.json
 * ──────────────────────────────────────────────────────────────────────
 * La versión anterior era:
 *
 *   "build": "tsc -p tsconfig.build.json && node -e \"...\""
 *
 * Ese `&&` funciona en bash, pero **no en cmd.exe ni en PowerShell**, que es
 * lo que usa por defecto `pnpm` en Windows. En la otra máquina el build
 * fallaría con «&& no se reconoce como un comando».
 *
 * Hacer las dos cosas dentro de un único programa Node evita el problema:
 * npm ejecuta `node scripts/build.mjs` en cualquier sistema operativo.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

console.log('[build] Compilando TypeScript…');

execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsc', '-p', 'tsconfig.build.json'],
  { cwd: RAIZ, stdio: 'inherit' }
);

/*
 * `tsc` compila SOLO archivos .ts. Los JSON de las plantillas de alerta no
 * se copian solos, y sin ellos el catálogo aparecería vacío en producción.
 */
const origen = path.join(RAIZ, 'src', 'plantillas-alerta');
const destino = path.join(RAIZ, 'dist', 'plantillas-alerta');

if (existsSync(origen)) {
  // Se limpia el destino para no dejar plantillas eliminadas del repositorio.
  if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
  cpSync(origen, destino, { recursive: true });
  console.log('[build] Plantillas de alerta copiadas a dist/');
} else {
  console.warn('[build] AVISO: no existe src/plantillas-alerta');
}

console.log('[build] Completado.');
