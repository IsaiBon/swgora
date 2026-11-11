import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const token = env.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.trim()
const proj = env.match(/SUPABASE_PROJECT_ID=(.*)/)?.[1]?.trim()

if (!token || !proj) {
  console.error('Faltan credenciales de Supabase en .env')
  process.exit(1)
}

const sql = fs.readFileSync('supabase/migrations/20261111085000_create_ordenes_trabajo_table.sql', 'utf8')

console.log('Aplicando migración a Supabase...')
const res = await fetch(`https://api.supabase.com/v1/projects/${proj}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
})

const result = await res.json()
console.log('Resultado de la migración:', result)
