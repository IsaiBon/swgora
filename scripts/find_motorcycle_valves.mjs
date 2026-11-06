import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function findMotorcycleValves() {
  const { data: dokuroParts } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, codigo_oem, categoria, dimensiones, especificaciones_tecnicas')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' });

  const auditData = JSON.parse(fs.readFileSync('RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json', 'utf8'));
  const motoIds = new Set();
  for (const item of auditData) {
    if ((item.subtipos || []).includes('motorcycle')) {
      if (item.codigo_catalogo) motoIds.add(item.codigo_catalogo.toUpperCase());
      if (item.codigo_dokuro) motoIds.add(item.codigo_dokuro.toUpperCase());
      for (const r of item.referencias || []) motoIds.add(r.toUpperCase());
    }
  }

  const toDelete = [];
  for (const p of dokuroParts || []) {
    const code = p.codigo_oem?.toUpperCase();
    const dok = p.especificaciones_tecnicas?.codigo_dokuro?.toUpperCase();
    const nameLower = (p.nombre || '').toLowerCase();

    if (
      motoIds.has(code) ||
      motoIds.has(dok) ||
      p.especificaciones_tecnicas?.subtipo === 'motorcycle' ||
      nameLower.includes('(yamaha)') ||
      nameLower.includes('(kawasaki)') ||
      (p.categoria === 'Válvulas' && !p.diametro_cabeza_mm && !p.dimensiones?.diametro_cabeza_mm && !p.dimensiones?.hongo_mm && (nameLower.includes('motorcycle') || /^\d{3}-\d{5}/.test(code || '')))
    ) {
      toDelete.push(p);
    }
  }

  console.log(`Found ${toDelete.length} motorcycle / dimension-less Dokuro parts to remove.`);
  toDelete.slice(0, 10).forEach(x => console.log('  -', x.codigo_oem, x.nombre));
}

findMotorcycleValves();

