import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const token = env.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.trim()
const proj = env.match(/SUPABASE_PROJECT_ID=(.*)/)?.[1]?.trim()

const sql = `
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Cliente';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON public.clientes (codigo);
NOTIFY pgrst, 'reload schema';
`

const res = await fetch(`https://api.supabase.com/v1/projects/${proj}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
})

console.log(await res.json())
