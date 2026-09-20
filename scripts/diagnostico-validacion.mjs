import { z } from 'zod';

const medicionEntradaSchema = z
  .object({
    canal: z.string().min(1).optional(),
    sensor: z.string().min(1).optional(),
    valor: z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.record(z.string(), z.unknown()),
      z.null(),
    ]),
  })
  .refine((m) => m.canal !== undefined || m.sensor !== undefined, {
    message: 'Canal o sensor',
  });

function probar(nombre, payload) {
  const r = z
    .object({ dispositivo: z.string(), mediciones: z.array(medicionEntradaSchema) })
    .safeParse(payload);
  if (r.success) {
    console.log(`${nombre} → ✅ VÁLIDO`);
  } else {
    console.log(
      `${nombre} → ❌ ${JSON.stringify(
        r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }))
      )}`
    );
  }
}

console.log('--- El JSON tal como lo muestras ---');
probar('numero real 24.8      ', {
  dispositivo: 'ESP32W',
  mediciones: [
    { canal: 'DHT1W-TEMPERATURA', valor: 24.8 },
    { canal: 'DHT1W-HUMEDAD_RELATIVA', valor: 68 },
  ],
});

console.log('\n--- Sospechas: qué llega realmente desde Node-RED ---');
probar('string "24.8"          ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: '24.8' }],
});
probar('string "24.8 C"        ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: '24.8 C' }],
});
probar('string vacío ""        ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: '' }],
});
probar('valor ausente         ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA' }],
});
probar('valor undefined       ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: undefined }],
});
probar('NaN (→ null en JSON)  ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: NaN }],
});
probar('objeto {v: 24.8}      ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: { v: 24.8 } }],
});
probar('array [24.8]          ', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: 'DHT1W-TEMPERATURA', valor: [24.8] }],
});
probar('canal vacío + valor ok', {
  dispositivo: 'ESP32W',
  mediciones: [{ canal: '', valor: 24.8 }],
});
