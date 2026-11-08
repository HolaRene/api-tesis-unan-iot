const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");

const src = fs.readFileSync(
  path.resolve(__dirname, "../../docs/node-red/comandos-plc-sondeo.js"),
  "utf8"
);

const partes = src.split(/\/\* ═+\n\s+BLOQUE (\d)/);
const resultados = [];

for (let i = 1; i < partes.length; i += 2) {
  const num = partes[i];
  let cuerpo = partes[i + 1];
  cuerpo = cuerpo.slice(cuerpo.indexOf("═ */") + 4);
  cuerpo = cuerpo.slice(0, cuerpo.lastIndexOf("/* ═"));

  const codigo = "async function bloque() {\n" + cuerpo + "\n}\n";
  const ruta = path.join(os.tmpdir(), `bloque-${num}.mjs`);
  fs.writeFileSync(ruta, codigo, "utf8");

  try {
    execFileSync(process.execPath, ["--check", ruta], { stdio: "pipe" });
    resultados.push(`  bloque ${num}: OK`);
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString().split("\n").slice(0, 2).join(" ") : String(e);
    resultados.push(`  bloque ${num}: ERROR — ${msg.trim()}`);
  }
  fs.unlinkSync(ruta);
}

console.log(resultados.join("\n"));
