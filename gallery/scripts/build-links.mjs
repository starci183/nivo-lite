// Maps the raw capture (gallery/capture/<agent>.json, from capture-links.cjs) onto gallery pages and writes
// gallery/pages/<area>/<page>/links.json:  [{ label, box:{x,y,w,h}, to: "<area>/<page>" | null, kind: "page"|"overlay", note?, route? }]
// A page is a folder that has an explain.md; its route comes from the front-matter `route`. A state folder (open drawer, pressed step)
// is a folder `<page>-<state>` beside its page with the same route: an overlay edge points to it.
// usage: node scripts/build-links.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = path.join(root, 'pages')
const AGENTS = ['sales', 'accounting', 'chatbot']
const DEFAULT_TAB = { sales: 'attention', accounting: 'today', chatbot: 'inbox' }

const fm = (md) => {
  const m = md.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/)
  const meta = {}
  if (m) for (const l of m[1].split('\n')) { const x = l.match(/^(\w+):\s*(.*)$/); if (x) meta[x[1]] = x[2].replace(/^["']|["']$/g, '') }
  return meta
}

// Same normal form as capture-links.cjs: ids -> <inst>/<id>, only tab/view kept.
const normRoute = (route, agent) => {
  const token = route.trim().split(/\s+/)[0]
  const [pth, qs = ''] = token.split('?')
  let p = pth.replace(/\/+$/, '')
  p = p.replace('<module>/<installation>', `${agent}/<inst>`).replace('<installation>', '<inst>').replace(/<(workflowKey|runId|agentId|id)>/g, '<id>')
  const q = new URLSearchParams(qs)
  const qq = ['tab', 'view'].filter((k) => q.has(k)).map((k) => `${k}=${q.get(k)}`).join('&')
  return p + (qq ? '?' + qq : '')
}

// Folders whose explain.md has no `route` yet (the gallery agent is still migrating them): infer it from the folder name.
const AG = '/workspaces/<ws>/agents/<module>/<installation>'
const inferRoute = (area, page, agent) => {
  const n = agent ? page.slice(agent.length + 1) : page
  const table = {
    'agent-setup': { 'huong-dan': '/setup', chung: '/setup/general' },
    'agent-work': { work: '/work', 'luot-chay': '/work?view=runs', 'cong-viec-luot-chay': '/work?view=runs' },
    'agent-chat': { chat: '/chat' }, 'agent-connections': { connections: '/connections', 'connections-cap-quyen': '/connections' },
    'agent-knowledge': { knowledge: '/knowledge' }, 'agent-graph': { graph: '/graph' },
    'agent-workflows': { list: '/workflows', create: '/workflows' },
  }
  if (area === 'agent-workbench' && agent) {
    const tabs = {
      sales: { 'wb-can-chu-y': 'attention', 'wb-tien-trinh-ban': 'pipeline', 'wb-don-hang': 'orders', 'wb-quy-tac': 'settings' },
      chatbot: { 'wb-hop-thu': 'inbox', 'wb-khach-dang-xu-ly': 'customers', 'wb-quy-tac': 'rules', 'wb-chua-tra-loi-duoc': 'unanswered' },
      accounting: { 'wb-hom-nay': 'today', 'wb-tong-quan-ky': 'overview', 'wb-chung-tu': 'book', 'wb-so': 'ledger', 'wb-quy-tac': 'settings' },
    }[agent]
    const k = Object.keys(tabs).find((x) => n === x || n.startsWith(x + '-'))
    if (k) return AG + '/workbench?tab=' + tabs[k]
  }
  const sub = table[area]?.[n]
  if (sub) return AG + sub
  const dm = area === 'agent-workflows' && n.match(/^detail-(map|io|runs|versions)(-|$)/)
  if (dm) return AG + '/workflows/<id>/' + dm[1]
  if (area === 'agent-work' && n.startsWith('luot-chay-loi')) return AG + '/work/runs/<id>'
  return ''
}

// folders
const folders = []
for (const area of fs.readdirSync(pagesDir)) {
  const ad = path.join(pagesDir, area)
  if (!fs.statSync(ad).isDirectory()) continue
  for (const page of fs.readdirSync(ad)) {
    const ex = path.join(ad, page, 'explain.md')
    if (!fs.existsSync(ex)) continue
    const meta = fm(fs.readFileSync(ex, 'utf8'))
    const agent0 = AGENTS.find((a) => page.startsWith(a + '-') || meta.agent === a) ?? null
    const agent = agent0
    folders.push({ id: `${area}/${page}`, area, page, meta, agent, route: meta.route || inferRoute(area, page, agent) })
  }
}

const out = {}
const byId = new Map(folders.map((f) => [f.id, f]))
const candidates = (agent, routeKey) => folders.filter((f) => {
  if (!f.route.startsWith('/')) return false
  if (f.agent && f.agent !== agent) return false
  if (!f.agent && agent && agent !== 'sales' && f.route.includes('<module>')) {
    // an unprefixed agent page belongs to the default agent (sales) unless a prefixed twin exists
    return false
  }
  return normRoute(f.route, agent ?? 'sales') === routeKey
})
const rank = (f) => (/-(map|overview)$/.test(f.page) ? 0 : 1) // the default tab of a detail page
const pickBase = (list) => [...list].sort((a, b) => Number(!!b.agent) - Number(!!a.agent) || rank(a) - rank(b) || a.page.length - b.page.length || a.page.localeCompare(b.page))[0]
const withDefaultTab = (k, agent) => (k.endsWith('/workbench') ? `${k}?tab=${DEFAULT_TAB[agent]}` : k)

const stateFoldersOf = (base) => folders.filter((f) => f.id !== base.id && f.area === base.area && f.page.startsWith(base.page + '-') && normRoute(f.route, f.agent ?? 'sales') === normRoute(base.route, base.agent ?? 'sales'))
const stateFor = (base, hint) => {
  const list = stateFoldersOf(base)
  if (!list.length) return null
  const h = (hint || '').toLowerCase()
  return (list.find((f) => h && (f.meta.title || '').toLowerCase().includes(h)) ?? list.sort((a, b) => a.page.localeCompare(b.page))[0]).id
}

const normKey = (k) => k.replace(/\/workflows\/[^/?]+/, '/workflows/<id>').replace(/\/work\/runs\/[^/?]+/, '/work/runs/<id>')
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
// in-page tab (no URL of its own) -> the sibling folder of the same route that shows that tab
const TAB_WORDS = [[/so do|map|ban do/, /map$/], [/vao|io|dau ra/, /io$/], [/luot chay|runs/, /runs$/], [/phien ban|version/, /versions$/]]
const tabTarget = (base, label) => {
  const sibs = folders.filter((f) => f.id !== base.id && f.area === base.area && f.agent === base.agent && normRoute(f.route, f.agent ?? 'sales') === normRoute(base.route, base.agent ?? 'sales') && !folders.some((o) => o.id !== f.id && f.page.startsWith(o.page + '-')))
  const l = slug(label)
  for (const [lw, pw] of TAB_WORDS) if (lw.test(l)) return sibs.find((f) => pw.test(f.page))?.id ?? null
  return null
}
const pagesOfAgent = {}
let written = 0, linksTotal = 0
for (const agent of AGENTS) {
  const file = path.join(root, process.env.CAPTURE_DIR ?? 'capture', `${agent}.json`)
  if (!fs.existsSync(file)) continue
  const cap = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const pg of cap.pages) {
    const key = withDefaultTab(normKey(pg.key), agent)
    const base = pickBase(candidates(agent, key))
    if (!base) { (pagesOfAgent[agent] ??= { unmapped: [] }).unmapped.push(pg.key); continue }
    const links = []
    for (const l of pg.links) {
      if (l.kind === 'self' || /trợ lý NIVO/i.test(l.label)) continue
      let to = null, kind = l.kind === 'overlay' || l.kind === 'tab' ? 'overlay' : 'page', note
      if (l.kind === 'tab') {
        const t = tabTarget(base, l.label)
        if (!t || t === base.id) continue // a tab that only switches a view inside the page is not a navigation
        links.push({ label: l.label, box: l.box, to: t, kind: 'overlay', note: 'tab trong trang' })
        continue
      }
      if (kind === 'overlay') {
        to = stateFor(base, l.hint)
        if (!to) note = 'mở lớp phủ nhưng chưa có thư mục trạng thái'
      } else if (l.data && byId.has(l.toKey)) {
        to = l.toKey // data-gallery-to names the gallery page itself
      } else if (l.toKey) {
        const tk = withDefaultTab(normKey(l.toKey), agent)
        const t = pickBase(candidates(agent, tk))
        if (t) to = t.id
        else note = 'trỏ tới trang chưa có trong gallery'
      } else note = 'bấm không có phản ứng'
      if (to === base.id) continue
      const rec = { label: l.label, box: l.box, to, kind }
      if (note) rec.note = note
      if (!to && l.toKey) rec.route = l.toKey.replace('/workspaces/<ws>', '')
      links.push(rec)
    }
    // a folder may be mapped from several agents' captures (unprefixed twin): keep the one with most links
    if (!out[base.id] || out[base.id].length < links.length) out[base.id] = links
  }
}
for (const [id, links] of Object.entries(out)) {
  fs.writeFileSync(path.join(pagesDir, id, 'links.json'), JSON.stringify(links, null, 1) + '\n')
  written++; linksTotal += links.length
}
console.log(`links.json written for ${written} pages, ${linksTotal} links`)
for (const [a, v] of Object.entries(pagesOfAgent)) console.log(`unmapped captured pages (${a}):`, v.unmapped.join(', '))
