import { parseExplain } from './explain.js'

const imgs = import.meta.glob('/pages/**/*.png', { eager: true, query: '?url', import: 'default' })
const mds = import.meta.glob('/pages/**/explain.md', { eager: true, query: '?raw', import: 'default' })

// tree[area][page] = { images: [{file, url, before}], explain }
const tree = {}
const ensure = (area, page) => ((tree[area] ??= {})[page] ??= { images: [], explain: null })
for (const [p, url] of Object.entries(imgs)) {
  const [area, page, ...rest] = p.replace('/pages/', '').split('/')
  if (rest.length === 1) ensure(area, page).images.push({ file: rest[0].replace(/\.png$/, ''), url })
}
for (const [p, raw] of Object.entries(mds)) {
  const [area, page] = p.replace('/pages/', '').split('/')
  ensure(area, page).explain = parseExplain(raw)
}
const badRegions = (pg) => (pg.explain ? pg.explain.regions.filter((r) => r.problems.length).length + (pg.explain.regions.length ? 0 : 1) : 0)
const isBad = (pg) => !pg.explain || badRegions(pg) > 0
// Owner rule: only pages that have an explain.md are shown; the rest are only counted and listed (collapsed).
const unexplained = []
for (const a of Object.keys(tree)) {
  for (const n of Object.keys(tree[a])) {
    if (!tree[a][n].explain) { unexplained.push(`${a}/${n}`); delete tree[a][n] }
  }
  if (!Object.keys(tree[a]).length) delete tree[a]
}
const AGENT_AREAS = ['shell', 'agents-catalog', 'agent-workbench', 'agent-work', 'agent-graph', 'agent-workflows', 'agent-setup', 'agent-chat', 'agent-connections', 'agent-knowledge', 'flowgraph']
const agentAreas = AGENT_AREAS.filter((a) => tree[a])
const otherAreas = Object.keys(tree).filter((a) => !AGENT_AREAS.includes(a)).sort()
const areas = [...agentAreas, ...otherAreas]
const agentUnexplained = unexplained.filter((u) => AGENT_AREAS.includes(u.split('/')[0]))
const totals = { pages: 0, noExplain: agentUnexplained.length, regions: 0, badRegions: 0, badPages: 0 }
for (const a of agentAreas) {
  for (const pg of Object.values(tree[a])) {
    totals.pages++
    totals.regions += pg.explain.regions.length
    totals.badRegions += badRegions(pg)
    if (isBad(pg)) totals.badPages++
  }
}

const state = { area: areas[0] ?? '', page: null, q: '', onlyBugs: false, width: '1440', showUnexplained: false }
const app = document.querySelector('#app')
const el = (tag, attrs = {}, ...kids) => { const n = Object.assign(document.createElement(tag), attrs); n.append(...kids); return n }
const badge = (t) => el('span', { className: 'badge', textContent: t })
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')

// A file is `[<agent>-]<width>[-<state>]`, e.g. 1440, 1440-open, sales-1920, chatbot-390-end.
const widthOf = (file) => (file.match(/(?:^|-)(\d{3,4})(?:z\d+)?(?=-|$)/) ?? [])[1] ?? 'default'
const widthsOf = (pg) => [...new Set(pg.images.map((i) => widthOf(i.file)))].sort((a, b) => Number(a) - Number(b))
const imagesFor = (pg, w) => pg.images.filter((i) => widthOf(i.file) === w)

const render = () => {
  app.replaceChildren()
  const side = el('aside', {}, el('h1', { textContent: 'NIVO gallery' }))
  side.append(el('a', { className: 'area', href: '/flow.html', textContent: 'Bản đồ luồng →', style: 'text-decoration:none;color:inherit;display:block;margin-bottom:8px;border-bottom:1px solid var(--line)' }))
  const areaBtn = (a) => {
    const n = Object.keys(tree[a]).length
    const bad = Object.values(tree[a]).filter(isBad).length
    const b = el('button', { className: 'area' + (a === state.area ? ' on' : '') }, a, el('span', { className: 'chip' + (bad ? ' red' : ''), textContent: `${bad}/${n}` }))
    b.onclick = () => { state.area = a; state.page = null; render() }
    return b
  }
  for (const a of agentAreas) side.append(areaBtn(a))
  if (otherAreas.length) {
    const g = el('details', { className: 'others', open: otherAreas.includes(state.area) }, el('summary', { textContent: `Khác (chưa rà) · ${otherAreas.length}` }))
    for (const a of otherAreas) g.append(areaBtn(a))
    side.append(g)
  }
  const summary = el('div', { className: 'summary' + (totals.badPages ? '' : ' ok') },
    el('b', { textContent: `${totals.badPages} trang lỗi giải thích` }),
    ` · ${totals.badRegions} vùng SAI / CHƯA RÕ / thiếu Vì sao-Grammar · ${totals.regions} vùng đã ghi · ${totals.pages} trang có giải thích (chỉ khu agent; "Khác" không tính)`)
  const un = el('details', { className: 'summary unexplained' }, el('summary', { textContent: `Chưa có giải thích (khu agent): ${agentUnexplained.length} trang (không hiển thị)` }), el('ul', {}, ...agentUnexplained.map((u) => el('li', { textContent: u }))))
  const main = el('main', {}, summary, un)
  main.append(state.page ? renderPage() : renderList())
  app.append(el('div', { className: 'shell' }, side, main))
}

const renderList = () => {
  const input = el('input', { placeholder: 'Tìm trang', value: state.q })
  const cb = el('input', { type: 'checkbox', checked: state.onlyBugs })
  const only = el('label', { className: 'only' }, cb, ' chỉ trang lỗi')
  const list = el('div', { className: 'cards' })
  const fill = () => {
    list.replaceChildren()
    const names = Object.keys(tree[state.area] ?? {}).sort().filter((n) => n.includes(state.q.toLowerCase()) && (!state.onlyBugs || isBad(tree[state.area][n])))
    if (!names.length) list.append(el('p', { className: 'empty', textContent: 'Không có trang.' }))
    for (const n of names) {
      const pg = tree[state.area][n]
      const thumb = pg.images.find((i) => i.file === '1440') ?? pg.images[0]
      const cap = el('div', { className: 'cap' }, el('b', { textContent: n }))
      cap.append(!pg.explain ? badge('LỖI: thiếu giải thích') : badRegions(pg) ? badge(`LỖI: ${badRegions(pg)} vùng chưa rõ`) : el('span', { className: 'ok', textContent: '✓ đã giải thích' }))
      const c = el('button', { className: 'card' }, thumb ? el('img', { src: thumb.url, loading: 'lazy' }) : el('div'), cap)
      c.onclick = () => { state.page = n; render() }
      list.append(c)
    }
  }
  input.oninput = () => { state.q = input.value; fill() }
  cb.onchange = () => { state.onlyBugs = cb.checked; fill() }
  fill()
  return el('div', {}, el('div', { className: 'bar' }, input, only), list)
}

const renderPage = () => {
  const pg = tree[state.area][state.page]
  const back = el('button', { className: 'back', textContent: '← ' + state.area })
  back.onclick = () => { state.page = null; render() }
  const widths = widthsOf(pg)
  if (!widths.includes(state.width)) state.width = widths[0] ?? ''
  const seg = el('div', { className: 'seg' })
  for (const w of widths) {
    const b = el('button', { className: w === state.width ? 'on' : '', textContent: w })
    b.onclick = () => { state.width = w; render() }
    seg.append(b)
  }
  const shots = el('div', { className: 'shots' })
  const list = imagesFor(pg, state.width)
  if (!list.length) shots.append(el('p', { className: 'empty', textContent: 'Không có ảnh ở chế độ này.' }))
  for (const i of list) {
    const f = el('figure', {}, el('img', { src: i.url }), el('figcaption', { textContent: i.file }))
    f.onclick = () => { const lb = el('div', { className: 'lb' }, el('img', { src: i.url })); lb.onclick = () => lb.remove(); document.body.append(lb) }
    shots.append(f)
  }
  const ex = el('section', { className: 'explain' })
  if (!pg.explain) {
    ex.append(badge('LỖI: thiếu giải thích'), el('p', { textContent: 'Trang này chưa có explain.md. Mỗi vùng nhìn thấy phải có Vì sao + Luật + Grammar.' }))
  } else {
    const e = pg.explain
    ex.append(el('h2', { textContent: e.meta.title || state.page }), el('p', { className: 'meta', textContent: `route: ${e.meta.route ?? '—'} · khu: ${e.meta.area ?? state.area}` }))
    if (e.intro) ex.append(el('p', { innerHTML: inline(e.intro) }))
    if (!e.regions.length) ex.append(badge('LỖI: chưa có vùng nào'))
    for (const r of e.regions) {
      const box = el('div', { className: 'region' + (r.problems.length ? ' bad' : '') }, el('h3', { textContent: r.name }))
      for (const p of r.problems) box.append(badge('LỖI: ' + p))
      for (const f of ['Vì sao', 'Luật', 'Grammar']) if (r.fields[f]) box.append(el('p', { innerHTML: `<span class="k">${f}</span> ${inline(r.fields[f])}` }))
      ex.append(box)
    }
  }
  return el('div', {}, el('div', { className: 'bar' }, back, el('h2', { textContent: state.page }), seg), el('div', { className: 'split' }, shots, ex))
}
render()
