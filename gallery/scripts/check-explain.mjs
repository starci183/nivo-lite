// node scripts/check-explain.mjs [--list]
// Counts pages without explain.md and regions missing Vì sao/Grammar. Exit 1 when any bug exists.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseExplain } from '../src/explain.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pages')
let pages = 0
let missing = 0
let bad = 0
let regions = 0
const out = []
for (const area of readdirSync(root)) {
  for (const page of readdirSync(join(root, area))) {
    if (!statSync(join(root, area, page)).isDirectory()) continue
    pages++
    const f = join(root, area, page, 'explain.md')
    if (!existsSync(f)) { missing++; out.push(`${area}/${page}: LỖI thiếu explain.md`); continue }
    const e = parseExplain(readFileSync(f, 'utf8'))
    if (!e.regions.length) { bad++; out.push(`${area}/${page}: không có vùng nào`) }
    for (const r of e.regions) {
      regions++
      if (r.problems.length) { bad++; out.push(`${area}/${page} > ${r.name}: ${r.problems.join(', ')}`) }
    }
  }
}
if (process.argv.includes('--list')) console.log(out.join('\n'))
console.log(`pages=${pages} thiếu explain=${missing} vùng=${regions} vùng lỗi=${bad}`)
process.exit(missing + bad ? 1 : 0)
