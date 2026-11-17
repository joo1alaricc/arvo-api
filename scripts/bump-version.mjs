/* Isi ?v= pada link CSS/JS di public/*.html dengan hash isi file masing-masing.
   Jalan otomatis sebelum `npm run deploy`. Jalankan manual: node scripts/bump-version.mjs */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
const dir = new URL('../public/', import.meta.url)
for (const f of readdirSync(dir).filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(new URL(f, dir), 'utf8')
  const out = html.replace(/(href|src)="([\w.-]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, attr, name) => {
    if (!existsSync(new URL(name, dir))) return m
    const h = createHash('sha1').update(readFileSync(new URL(name, dir))).digest('hex').slice(0, 8)
    return `${attr}="${name}?v=${h}"`
  })
  if (out !== html) { writeFileSync(new URL(f, dir), out); console.log('updated', f) }
}
