// "Bản đồ luồng": the pages of one flow as screenshots on a zoomable canvas, a blue box on every control that goes somewhere,
// and an edge from that box to the page it opens. Links come from pages/<area>/<page>/links.json (scripts/capture-links.cjs).
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, useNodesState, useReactFlow, useUpdateNodeInternals, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import flows from '../flows.json'

const imgs = import.meta.glob('/pages/**/*.png', { eager: true, query: '?url', import: 'default' })
const mds = import.meta.glob('/pages/**/explain.md', { eager: true, query: '?raw', import: 'default' })
const lks = import.meta.glob('/pages/**/links.json', { eager: true, import: 'default' })

const pages = {} // id -> { id, title, route, img, links|null }
const idOf = (p) => p.replace('/pages/', '').split('/').slice(0, 2).join('/')
for (const [p, raw] of Object.entries(mds)) {
  const id = idOf(p)
  const meta = {}
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/)
  if (m) for (const l of m[1].split('\n')) { const x = l.match(/^(\w+):\s*(.*)$/); if (x) meta[x[1]] = x[2].replace(/^["']|["']$/g, '') }
  const h1 = (raw.match(/^#\s+(.+)$/m) || [])[1]
  pages[id] = { id, title: meta.title || h1 || id, route: meta.route || '', img: null, links: null }
}
for (const [p, url] of Object.entries(imgs)) {
  const parts = p.replace('/pages/', '').split('/')
  if (parts.length === 3 && parts[2] === '1440.png' && pages[parts.slice(0, 2).join('/')]) pages[parts.slice(0, 2).join('/')].img = url
}
for (const [p, v] of Object.entries(lks)) if (pages[idOf(p)]) pages[idOf(p)].links = v

const W = 420, GAP_X = 180, GAP_Y = 120
const isState = (id) => id.split('/')[1].includes('-') && Object.keys(pages).some((o) => o !== id && id.startsWith(o + '-'))

// ---- problems (global, over every page that was scanned) ----
const scanned = Object.values(pages).filter((p) => p.links)
const incoming = new Map()
for (const p of scanned) for (const l of p.links) if (l.to) incoming.set(l.to, (incoming.get(l.to) ?? 0) + 1)
const scannedAreas = new Set(scanned.map((p) => p.id.split('/')[0]))
const problems = {
  dead: scanned.flatMap((p) => p.links.map((l, i) => ({ p, l, i })).filter(({ l }) => !l.to)),
  orphan: Object.values(pages).filter((p) => !incoming.get(p.id) && scannedAreas.has(p.id.split('/')[0])),
  dup: scanned.flatMap((p) => {
    const g = {}
    p.links.forEach((l, i) => { if (l.to && l.kind === 'page') (g[l.to] ??= []).push(i) })
    return Object.entries(g).filter(([, v]) => v.length > 1).map(([to, idx]) => ({ p, to, idx }))
  }),
  unscanned: Object.values(pages).filter((p) => !p.links && !isState(p.id) && scannedAreas.has(p.id.split('/')[0])),
}
const deadNote = (l) => l.note ?? 'nút chưa dẫn tới đâu'
const deadGroups = Object.values(problems.dead.reduce((m, it) => {
  const k = `${deadNote(it.l)}|${it.l.route ?? it.p.id + '|' + it.l.label}`
  ;(m[k] ??= { k, note: deadNote(it.l), route: it.l.route, items: [] }).items.push(it)
  return m
}, {}))

function PageNode({ id, data }) {
  const pg = pages[data.pid]
  const [h, setH] = useState(0)
  const upd = useUpdateNodeInternals()
  useEffect(() => { upd(id) }, [h, id, upd])
  const dupIdx = new Set((problems.dup.find((d) => d.p.id === pg?.id)?.idx) ?? [])
  return (
    <div className={`fm-node${data.dim ? ' dim' : ''}${data.focus ? ' focus' : ''}${data.state ? ' state' : ''}`}>
      <Handle id="tl" type="target" position={Position.Left} className="fm-in" style={{ top: 24 }} />
      <Handle id="tr" type="target" position={Position.Right} className="fm-in" style={{ top: 24 }} />
      <div className="fm-title" title={pg?.route}>{pg?.title ?? data.pid}<small>{data.pid}</small></div>
      {pg?.img ? (
        <div className="fm-shot">
          <img src={pg.img} draggable={false} onLoad={(e) => setH(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)} />
          {h > 0 && (pg.links ?? []).map((l, i) => (
            <div key={i} className={`fm-hot${l.kind === 'overlay' ? ' over' : ''}${!l.to || dupIdx.has(i) ? ' bad' : ''}`} title={`${l.label}${l.to ? ' → ' + l.to : ' — ' + deadNote(l)}`}
              style={{ left: `${(l.box.x / 1440) * 100}%`, top: `${(l.box.y / 1440 / h) * 100}%`, width: `${(l.box.w / 1440) * 100}%`, height: `${(l.box.h / 1440 / h) * 100}%` }}>
              <Handle id={`r${i}`} type="source" position={Position.Right} style={{ top: '50%', right: -3 }} />
              <Handle id={`l${i}`} type="source" position={Position.Left} style={{ top: '50%', left: -3 }} />
            </div>
          ))}
        </div>
      ) : <div className="fm-miss">chưa có ảnh 1440.png</div>}
    </div>
  )
}
const nodeTypes = { page: PageNode }

const layout = (ids) => {
  const nodes = []
  const main = ids.filter((i) => pages[i] || true)
  main.forEach((pid, k) => nodes.push({ id: pid, type: 'page', position: { x: k * (W + GAP_X), y: 0 }, data: { pid } }))
  // state folders that a page of the flow opens sit under it
  let used = new Set(ids)
  for (const [k, pid] of main.entries()) {
    let row = 0
    for (const l of pages[pid]?.links ?? []) {
      if (l.kind === 'overlay' && l.to && !used.has(l.to)) {
        used.add(l.to); row++
        nodes.push({ id: l.to, type: 'page', position: { x: k * (W + GAP_X) + 60, y: 700 * row + 40 + GAP_Y }, data: { pid: l.to, state: true } })
      }
    }
  }
  return nodes
}

function Canvas({ flow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [focus, setFocus] = useState(null)
  const rf = useReactFlow()
  useEffect(() => { setNodes(layout(flow.pages)); setFocus(null); setTimeout(() => rf.fitView({ padding: 0.1 }), 150) }, [flow.pages.join('|')])

  const pos = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.position.x])), [nodes])
  const edges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id))
    const out = []
    for (const n of nodes) {
      ;(pages[n.id]?.links ?? []).forEach((l, i) => {
        if (!l.to || !ids.has(l.to)) return
        const right = (pos[l.to] ?? 0) >= (pos[n.id] ?? 0)
        const e = { id: `${n.id}#${i}`, source: n.id, sourceHandle: `${right ? 'r' : 'l'}${i}`, target: l.to, targetHandle: right ? 'tl' : 'tr', type: 'default',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2563EB' }, style: { stroke: '#2563EB', strokeWidth: 1.5, strokeDasharray: l.kind === 'overlay' ? '6 4' : undefined },
          data: { from: n.id, to: l.to } }
        if (focus && n.id !== focus && l.to !== focus) return
        out.push(e)
      })
    }
    return out
  }, [nodes, pos, focus])
  const related = useMemo(() => { if (!focus) return null; const s = new Set([focus]); edges.forEach((e) => { s.add(e.source); s.add(e.target) }); return s }, [focus, edges])
  const shown = nodes.map((n) => ({ ...n, data: { ...n.data, dim: related ? !related.has(n.id) : false, focus: n.id === focus } }))
  const go = useCallback((id) => { if (!pages[id]) return; setFocus(id); const n = nodes.find((x) => x.id === id); if (n) rf.setCenter(n.position.x + W / 2, n.position.y + 300, { zoom: 0.9, duration: 400 }) }, [nodes, rf])

  return (
    <>
      <div className="fm-canvas">
        <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} minZoom={0.05} maxZoom={2} fitView
          onNodeClick={(_, n) => setFocus((f) => (f === n.id ? null : n.id))} onPaneClick={() => setFocus(null)} proOptions={{ hideAttribution: true }}>
          <Background gap={22} size={1.4} color="#d9cfd2" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <Panel flow={flow} go={go} />
    </>
  )
}

function Panel({ flow, go }) {
  const inFlow = new Set(flow.pages)
  const missing = flow.pages.filter((p) => !pages[p])
  const row = (key, title, sub, id) => <button key={key} className="fm-prob" onClick={() => go(id)}>{title}<small>{sub}</small></button>
  return (
    <div className="fm-side">
      <h2>Luồng <span className="fm-chip ok">{flow.pages.length} trang</span></h2>
      <div style={{ fontSize: 12, color: '#555' }}>{flow.pages.map((p, i) => <div key={p}>{i + 1}. {pages[p]?.title ?? p}</div>)}</div>
      {missing.length > 0 && <><h2>Thiếu trang <span className="fm-chip">{missing.length}</span></h2>{missing.map((m) => <div key={m} style={{ fontSize: 12 }}>{m}</div>)}</>}
      <h2>Nút chưa dẫn tới đâu <span className={`fm-chip${problems.dead.length ? '' : ' ok'}`}>{problems.dead.length}</span></h2>
      {deadGroups.map((g) => row(g.k, g.route ? g.route : `${g.items[0].l.label} (mở lớp phủ)`, `${g.items.length} nút · ${g.note} · vd ${g.items.slice(0, 2).map((x) => x.l.label || '—').join(', ')} @ ${g.items[0].p.id}`, g.items[0].p.id))}
      <h2>Trang không có đường vào <span className={`fm-chip${problems.orphan.length ? '' : ' ok'}`}>{problems.orphan.length}</span></h2>
      {problems.orphan.map((p) => row(p.id, p.title, p.id, p.id))}
      <h2>Hai nút cùng dẫn tới một nơi <span className={`fm-chip${problems.dup.length ? '' : ' ok'}`}>{problems.dup.length}</span></h2>
      {problems.dup.map((d) => row(d.p.id + d.to, `${d.idx.map((i) => d.p.links[i].label).join(' = ')}`, `${d.p.id} → ${d.to}`, d.p.id))}
      <h2>Chưa quét liên kết <span className="fm-chip">{problems.unscanned.length}</span></h2>
      {problems.unscanned.map((p) => row(p.id, p.title, p.id, p.id))}
      <div style={{ fontSize: 12, color: '#777', marginTop: 12 }}>Bấm một trang để chỉ xem đường vào/ra của nó. Ô xanh nét liền = chuyển trang, nét đứt = mở lớp phủ, ô đỏ = chưa dẫn tới đâu.</div>
    </div>
  )
}

const AGENT_NAMES = { sales: 'Sales', accounting: 'Kế toán', chatbot: 'Chatbot' }
function App() {
  const [fi, setFi] = useState(0)
  const [agent, setAgent] = useState('sales')
  const flow = useMemo(() => ({ ...flows[fi], pages: flows[fi].pages.map((p) => (typeof p === 'string' ? p : (p[agent] ?? p.default)).replace('{agent}', agent)) }), [fi, agent])
  return (
    <div className="fm">
      <div className="fm-top"><a href="/">← Gallery</a><b>Bản đồ luồng</b>
        {flows.map((f, i) => <button key={f.name} className={`fm-pill${i === fi ? ' on' : ''}`} onClick={() => setFi(i)}>{f.name}</button>)}
        <span style={{ width: 16 }} />
        {Object.entries(AGENT_NAMES).map(([k, v]) => <button key={k} className={`fm-pill${k === agent ? ' on' : ''}`} onClick={() => setAgent(k)}>{v}</button>)}
        <span className="fm-hint">kéo nút để dời · cuộn để phóng/thu · bấm trang để lọc</span></div>
      <ReactFlowProvider><Canvas flow={flow} /></ReactFlowProvider>
    </div>
  )
}
createRoot(document.getElementById('flow')).render(<App />)
