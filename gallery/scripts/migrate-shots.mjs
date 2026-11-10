// HISTORICAL one-off: shots/<area>/<page>__<width>__after.png -> pages/<area>/<page>/<width>.png. Before shots are skipped (no before/ in the gallery).
// pages/ has since been curated by hand (duplicates removed, states split into own folders); re-running recreates them, so it needs --force.
// Safe to re-run: copies only, never deletes shots/.
import { cpSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'shots')
const dst = join(root, 'pages')
const isWidth = (t) => /^\d{3,4}(z\d+)?$/.test(t)

export const classify = (file) => {
  const name = file.replace(/\.png$/i, '')
  const [first, ...rest] = name.split('__')
  let page = first
  let width = ''
  let stage = 'after'
  const state = []
  for (const t of rest) {
    if (isWidth(t)) width = t
    else if (/^before/.test(t)) { stage = 'before'; const m = t.match(/-(\d+)$/); if (m) width = m[1] }
    else if (/^after/.test(t)) {
      stage = 'after'
      const m = t.match(/^after-(\d{3,4})$/)
      if (m) width = m[1]
      else if (t !== 'after') state.push(t.replace(/^after-/, ''))
    } else if (t === 'audit') stage = 'audit'
    else page += '-' + t
  }
  const m = page.match(/^(.*)-(\d{3,4})$/)
  if (!width && m && rest.length) { page = m[1]; width = m[2] }
  if (!width) width = 'default'
  const base = [width, ...state].join('-')
  return { page, stage, file: stage === 'audit' ? `${base}-audit.png` : `${base}.png` }
}

if (!process.argv.includes('--force')) { console.log('pages/ is curated; pass --force to re-run the old migration'); process.exit(0) }
let copied = 0
const pages = new Set()
const clashes = []
for (const area of readdirSync(src)) {
  const dir = join(src, area)
  if (!statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.png')) continue
    const c = classify(f)
    if (c.stage === 'before') continue
    const out = join(dst, area, c.page, c.stage === 'before' ? 'before' : '', c.file)
    if (existsSync(out)) clashes.push(`${area}/${f} -> ${out}`)
    mkdirSync(dirname(out), { recursive: true })
    cpSync(join(dir, f), out)
    copied++
    pages.add(`${area}/${c.page}`)
  }
}
console.log(`copied ${copied} shots into ${pages.size} pages under pages/`)
if (clashes.length) console.log(`overwrote ${clashes.length} name clashes (last wins):\n` + clashes.join('\n'))
