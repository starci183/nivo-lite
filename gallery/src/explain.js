// Parse + check explain.md. The check is machine-readable: a region lacking `Vì sao` or `Grammar`
// (or whose value is empty / CHƯA RÕ) is a bug. Shared by the app and scripts/check-explain.mjs.
export const FIELDS = ['Vì sao', 'Luật', 'Grammar']

const fieldRe = (f) => new RegExp(`^\\s*(?:[-*]\\s*)?\\*{0,2}${f}:\\*{0,2}[ \\t]*`, 'i')

export const parseExplain = (md) => {
  let body = md.replace(/\r\n/g, '\n')
  const meta = {}
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/)
      if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    body = body.slice(fm[0].length)
  }
  const regions = []
  const intro = []
  let cur = null
  for (const line of body.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*$/)
    if (h) {
      cur = { name: h[1], fields: {}, problems: [] }
      regions.push(cur)
      continue
    }
    if (!cur) { intro.push(line); continue }
    const f = FIELDS.find((x) => fieldRe(x).test(line))
    if (f) { cur.fields[f] = line.replace(fieldRe(f), '').trim(); cur.last = f }
    else if (cur.last && line.trim()) cur.fields[cur.last] += ' ' + line.trim()
  }
  for (const r of regions) {
    delete r.last
    for (const f of ['Vì sao', 'Grammar']) {
      const v = r.fields[f]
      if (v === undefined || v === '') r.problems.push(`thiếu ${f}`)
      else if (/CHƯA RÕ/i.test(v)) r.problems.push(`${f}: CHƯA RÕ`)
      else if (f === 'Vì sao' && /^\**SAI\b/.test(v)) r.problems.push('SAI so với luật/Grammar')
    }
  }
  return { meta, intro: intro.join('\n').trim(), regions }
}
