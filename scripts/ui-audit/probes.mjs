// The DOM probes. `probe` is serialised into the page by Playwright, so it must stay self-contained (no imports, no outer
// variables). Pass "view" runs at the real viewport (what the owner sees at scroll 0); pass "content" runs on a viewport tall
// enough to show the whole scrolled well, so findings below the fold are seen too.
export function probe(opts) {
  const { pass } = opts
  const out = []
  const de = document.documentElement
  const vw = de.clientWidth
  const vh = window.innerHeight
  const sx = window.scrollX
  const sy = window.scrollY
  const q = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s))
  const csCache = new Map()
  const cs = (e) => {
    let s = csCache.get(e)
    if (!s) { s = getComputedStyle(e); csCache.set(e, s) }
    return s
  }
  // Excluded everywhere: code blocks, the brand logo, the Next dev overlay, anything marked data-audit-ignore.
  const EXCL = 'pre, code, kbd, samp, script, style, noscript, nextjs-portal, [data-audit-ignore], .starci-core-top-bar-brand, #__next-build-watcher'
  const seen = new Set()
  let counter = 0
  const docBox = (r) => ({ x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height) })

  const clipped = (e, r) => {
    for (let p = e.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
      const s = cs(p)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const pr = p.getBoundingClientRect()
      if (r.right <= pr.left + 0.5 || r.left >= pr.right - 0.5 || r.bottom <= pr.top + 0.5 || r.top >= pr.bottom - 0.5) return true
    }
    return false
  }
  const visible = (e, ignoreAria) => {
    const r = e.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = cs(e)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    if (e.closest('[hidden],[inert]')) return false
    if (!ignoreAria && e.closest('[aria-hidden="true"]')) return false
    return !clipped(e, r)
  }
  const sel = (e) => {
    const parts = []
    let n = e
    for (let i = 0; n && n.nodeType === 1 && n !== document.body && i < 4; i++, n = n.parentElement) {
      let s = n.tagName.toLowerCase()
      if (n.id && !/[:0-9]/.test(n.id)) { parts.unshift(s + '#' + n.id); break }
      const cls = Array.prototype.slice.call(n.classList).filter((c) => /^(starci|grammar|button|tab|list)/.test(c))
      if (cls.length) s += '.' + cls.slice(0, 2).join('.')
      else if (n.getAttribute('role')) s += '[role=' + n.getAttribute('role') + ']'
      parts.unshift(s)
    }
    return parts.join(' > ')
  }
  const add = (rule, el, text, extra, rect) => {
    if (!el.__auditN) el.__auditN = ++counter
    const key = rule + '|' + (extra && extra.key ? extra.key : '') + '|' + el.__auditN
    if (seen.has(key)) return
    seen.add(key)
    const id = 'a' + Math.random().toString(36).slice(2, 9)
    const prev = el.getAttribute('data-audit-id')
    el.setAttribute('data-audit-id', prev ? prev + ' ' + id : id)
    const r = rect || el.getBoundingClientRect()
    const o = { rule, selector: sel(el), text: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120), box: docBox(r), id }
    if (extra) for (const k in extra) if (k !== 'key') o[k] = extra[k]
    out.push(o)
  }
  const parseColor = (c) => {
    if (/transparent/.test(c)) return 0
    const m = /\/\s*([\d.]+%?)\s*\)/.exec(c) || /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(c)
    if (!m) return 1
    return m[1].slice(-1) === '%' ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  }
  const COLOR_FN = /(rgba?|lab|oklab|oklch|lch|color|hsla?)\([^)]*\)/
  const hasShadow = (s) => {
    const v = s.boxShadow
    if (!v || v === 'none') return false
    const layers = []
    let depth = 0
    let cur = ''
    for (const ch of v) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ',' && depth === 0) { layers.push(cur); cur = '' } else cur += ch
    }
    layers.push(cur)
    return layers.some((l) => {
      const colour = COLOR_FN.exec(l)
      if (colour && parseColor(colour[0]) === 0) return false
      const nums = (l.replace(COLOR_FN, '').match(/-?[\d.]+px/g) || []).map(parseFloat)
      return nums.some((x) => x !== 0)
    })
  }
  const hasBorder = (s) => ['Top', 'Right', 'Bottom', 'Left'].some((d) => parseFloat(s['border' + d + 'Width']) > 0 && s['border' + d + 'Style'] !== 'none' && parseColor(s['border' + d + 'Color']) > 0.02)
  const opaqueBg = (s) => !!s.backgroundColor && parseColor(s.backgroundColor) > 0.5
  const effBg = (e) => {
    for (let p = e; p; p = p.parentElement) { const s = cs(p); if (opaqueBg(s)) return s.backgroundColor }
    return 'none'
  }

  // ───────────────────────── content pass ─────────────────────────
  if (pass === 'content') {
    const OK = [12, 14, 18, 20]
    const bad = (fs) => !OK.some((o) => Math.abs(o - fs) < 0.06)
    const RAW = [
      ['uuid', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i],
      ['camelCase', /(?<![\p{L}\p{N}_/@.:#-])[a-z]{2,}(?:[A-Z][a-z0-9]+)+(?![\p{L}\p{N}_])/u],
      ['snake_case', /(?<![\p{L}\p{N}_/@.:#-])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\p{N}_])/u],
      ['SCREAMING_CASE', /(?<![\p{L}\p{N}_/@.:#-])[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+(?![\p{L}\p{N}_])/u],
      ['repeated word', /(?<![\p{L}\p{N}])(\p{L}{2,})\s+\1(?![\p{L}\p{N}])/iu],
    ]
    const ALLOW = /^(iPhone|iPad|iOS|eBay|macOS|iMessage|iCloud|reCAPTCHA|oAuth)$/
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const fsSeen = new Set()
    let n = tw.nextNode()
    for (; n; n = tw.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim()
      if (!t) continue
      const p = n.parentElement
      if (!p || p.closest(EXCL) || p.closest('svg,option,select')) continue
      const av = p.closest('.starci-core-avatar')
      if (av && av.querySelector('img')) continue
      if (!visible(p)) continue
      const rg = document.createRange()
      rg.selectNodeContents(n)
      const rr = rg.getBoundingClientRect()
      if (rr.width < 1 || rr.height < 1) continue
      const fs = parseFloat(cs(p).fontSize)
      if (bad(fs) && !fsSeen.has(p)) { fsSeen.add(p); add('font-size', p, t, { value: fs + 'px' }, rr) }
      for (const [kind, re] of RAW) {
        const m = re.exec(t)
        if (m && !ALLOW.test(m[0])) { add('raw-key', p, m[0], { kind, key: kind + m[0] }, rr); break }
      }
      if (/→|⟶|->|=>/.test(t) && !p.closest('.starci-core-link-arrow')) add('typed-arrow', p, t, undefined, rr)
    }
    for (const i of q('input,textarea')) {
      if (i.closest(EXCL) || ['hidden', 'checkbox', 'radio', 'file', 'range', 'color'].indexOf(i.type) >= 0) continue
      if (!(i.value || i.placeholder) || !visible(i)) continue
      const fs = parseFloat(cs(i).fontSize)
      if (bad(fs)) add('font-size', i, i.value || i.placeholder, { value: fs + 'px', field: true })
    }

    // filled / solid icons
    const real = (c) => c.fill !== 'none' && !/transparent/.test(c.fill) && parseColor(c.fill) > 0
    for (const s of q('svg')) {
      if (s.closest(EXCL) || s.closest('.starci-core-avatar') || s.closest('.starci-core-link') || s.closest('.starci-core-flow-graph-background') || !visible(s, true)) continue
      const rootFill = s.getAttribute('fill')
      const shapes = q('path,circle,rect,polygon,ellipse', s)
      const strokes = !!s.getAttribute('stroke') || shapes.some((x) => !!x.getAttribute('stroke'))
      const evenodd = shapes.some((x) => x.getAttribute('fill-rule') === 'evenodd' || x.getAttribute('clip-rule') === 'evenodd')
      const solidShape = shapes.find((x) => { const c = cs(x); return real(c) && (c.stroke === 'none' || parseFloat(c.strokeWidth) === 0) })
      if ((rootFill === 'currentColor' && !strokes) || (evenodd && !strokes && rootFill !== 'none') || solidShape) {
        const host = s.closest('button,a')
        add('filled-icon', s, s.getAttribute('aria-label') || (host ? host.innerText : ''), { why: rootFill === 'currentColor' ? 'fill=currentColor' : evenodd ? 'evenodd path' : 'filled shape' })
      }
    }

    // surfaces on the pink well
    const root = q('.grammar-common-root')[0] || document.body
    const well = cs(root).backgroundColor
    const raised = []
    for (const e of q('div,section,article,form,table,ul,ol,dl,aside,nav')) {
      if (e.closest(EXCL) || e.closest('.starci-core-flow-graph, [class*=starci-core-flow-graph], .starci-core-message-bubble')) continue
      const r = e.getBoundingClientRect()
      if (r.width < 160 || r.height < 36) continue
      const s = cs(e)
      const sh = hasShadow(s)
      const bd = hasBorder(s)
      if (!sh && !bd) continue
      if (!opaqueBg(s) || !visible(e)) continue
      raised.push({ e, sh, bd })
    }
    const raisedSet = new Set(raised.map((x) => x.e))
    for (const { e, sh, bd } of raised) {
      if (e.parentElement && effBg(e.parentElement) === well && sh && bd) add('well-border+shadow', e, e.innerText, { key: 'bs' })
      let anc = null
      for (let p = e.parentElement; p; p = p.parentElement) if (raisedSet.has(p)) { anc = p; break }
      if (anc && /starci-core-pane/.test(String(anc.className))) anc = null // a surface on a white pane is meant to be bordered
      if (anc && !e.closest('.starci-core-data-table') && !anc.closest('.starci-core-data-table') && !e.closest('[role=dialog],[role=listbox],[role=menu],[role=tooltip],[popover]')) {
        add('card-in-card', e, e.innerText, { key: 'nest', inside: sel(anc) })
      }
    }

    // description under a section / card label
    const headSel = '.starci-core-surface-label, .starci-core-section-header-copy, .starci-core-pane-header-copy'
    const titleSel = 'h1,h2,h3,h4,h5,h6,.starci-core-label,.starci-core-section-title,.starci-core-pane-header-title,.starci-core-pane-header-title-line'
    const allowed = '.starci-core-section-count,.starci-core-surface-label-end,.starci-core-section-action,.starci-core-link,a,button,[role=tab],.starci-core-badge,.starci-core-badge-dot,.starci-core-chip,.starci-core-tab-count,.starci-core-icon-tile'
    const sentence = (t) => t.length >= 10 && /\s/.test(t)
    for (const head of q(headSel)) {
      if (head.closest(EXCL) || !visible(head)) continue
      for (const leaf of q('*', head)) {
        if (leaf.closest(titleSel) && head.contains(leaf.closest(titleSel))) continue
        if (leaf.closest(allowed) || leaf.querySelector('*') || !visible(leaf)) continue
        const t = (leaf.textContent || '').trim()
        if (sentence(t)) add('description-under-label', leaf, t, { key: 'in' })
      }
    }
    for (const head of q('.starci-core-section-header, .starci-core-surface-label, .starci-core-pane-header')) {
      const nx = head.nextElementSibling
      if (!nx || !visible(nx)) continue
      const t = (nx.textContent || '').trim()
      if (sentence(t) && (nx.matches('p,.starci-core-section-caption,.starci-core-surface-note') || (nx.classList.contains('starci-core-text') && !nx.querySelector('*')))) {
        add('description-under-label', nx, t, { key: 'next' })
      }
    }

    // tab labels carrying a count in text
    for (const t of q('[role=tab]')) {
      if (!visible(t)) continue
      const lab = t.querySelector('.starci-core-tab-label') || t
      const label = lab.textContent || ''
      if (/·\s*\d+|\(\d+\)/.test(label)) add('tab-count-text', t, label, { key: 'tc' })
    }
    return { findings: out, meta: { well } }
  }

  // ───────────────────────── view pass ─────────────────────────
  const meta = { vw, vh }
  const bars = q('.starci-core-top-bar, .starci-core-workspace-shell-compact-header').filter((b) => visible(b))
  const barBottom = bars.length ? Math.max.apply(null, bars.map((b) => b.getBoundingClientRect().bottom)) : 0
  const header = q('.starci-core-page-header').filter((h) => visible(h))[0]

  // header band flush under the app bar; nothing hidden under it at scroll 0
  if (header) {
    const hr = header.getBoundingClientRect()
    const gap = Math.round((hr.top - barBottom) * 10) / 10
    if (Math.abs(gap) > 2) add('band-gap', header, 'band top ' + Math.round(hr.top) + ' vs app bar bottom ' + Math.round(barBottom), { value: gap + 'px', key: 'gap' })
    const body = q('.starci-core-page-body')[0]
    if (body && sy === 0 && cs(header).position !== 'static') {
      const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
      let found = 0
      for (let n = tw.nextNode(); n && found < 5; n = tw.nextNode()) {
        if (!n.nodeValue.trim()) continue
        const p = n.parentElement
        if (!p || header.contains(p) || p.closest(EXCL) || !visible(p)) continue
        const rg = document.createRange()
        rg.selectNodeContents(n)
        const r = rg.getBoundingClientRect()
        if (r.height > 0 && r.top >= 0 && r.top < hr.bottom - 2 && r.bottom > hr.top + 2) {
          const top = document.elementFromPoint(Math.min(vw - 1, r.left + 2), Math.min(vh - 1, r.top + r.height / 2))
          if (top && header.contains(top)) { add('hidden-under-band', p, n.nodeValue, { key: 'hid' }, r); found++ }
        }
      }
    }
  }

  // scroll containers: the band must never scroll away
  const scrollers = []
  if (de.scrollHeight > de.clientHeight + 4) scrollers.push(de)
  for (const e of q('*')) {
    const s = cs(e)
    if (!/(auto|scroll)/.test(s.overflowY) || e.scrollHeight <= e.clientHeight + 4) continue
    if (e.clientHeight < 120 || !visible(e)) continue
    scrollers.push(e)
  }
  let extra = 0
  for (const s of scrollers) extra = Math.max(extra, s.scrollHeight - s.clientHeight)
  meta.extra = extra
  if (header) {
    const hr0 = header.getBoundingClientRect()
    for (const s of scrollers.slice(0, 6)) {
      const prev = s.scrollTop
      s.scrollTop = s.scrollHeight
      const hr1 = header.getBoundingClientRect()
      s.scrollTop = prev
      if (Math.abs(hr1.top - hr0.top) > 2 || hr1.bottom <= barBottom + 4) {
        add('band-scrolls', header, 'band moved ' + Math.round(hr1.top - hr0.top) + 'px when ' + sel(s) + ' scrolled', { key: 'sc' })
        break
      }
    }
  }

  // visible scrollbars (Chromium is launched without --hide-scrollbars so they render as the owner sees them)
  if (window.innerWidth - de.clientWidth > 1) add('scrollbar', de, 'page scrollbar ' + (window.innerWidth - de.clientWidth) + 'px', { key: 'doc' })
  for (const e of q('*')) {
    if (e === de || e.closest(EXCL)) continue
    const s = cs(e)
    const bw = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth)
    const bh = parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth)
    const v = /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && e.offsetWidth - e.clientWidth - bw > 1
    const h = /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.offsetHeight - e.clientHeight - bh > 1
    if ((v || h) && visible(e)) add('scrollbar', e, (v ? 'vertical ' : 'horizontal ') + (v ? e.offsetWidth - e.clientWidth - bw : e.offsetHeight - e.clientHeight - bh) + 'px', { key: 'el' })
  }

  // side panes flush to the viewport edge (layout B)
  const panes = q('.starci-core-pane').filter((p) => visible(p) && p.getBoundingClientRect().width > 60)
  const lefts = new Set(panes.map((p) => Math.round(p.getBoundingClientRect().left)))
  if (panes.length > 1 && lefts.size > 1) {
    let right = panes[0]
    let left = panes[0]
    for (const p of panes) {
      if (p.getBoundingClientRect().right > right.getBoundingClientRect().right) right = p
      if (p.getBoundingClientRect().left < left.getBoundingClientRect().left) left = p
    }
    const gap = Math.round((vw - right.getBoundingClientRect().right) * 10) / 10
    if (gap > 2) add('aside-not-flush', right, 'right pane ends ' + gap + 'px short of the viewport edge', { value: gap + 'px', key: 'r' })
    const main = document.querySelector('.starci-core-workspace-shell-primary')
    if (main) {
      const lg = Math.round((left.getBoundingClientRect().left - main.getBoundingClientRect().left) * 10) / 10
      if (lg > 2) add('aside-not-flush', left, 'left pane starts ' + lg + 'px after the content edge', { value: lg + 'px', key: 'l' })
    }
  }

  // horizontal page overflow
  if (de.scrollWidth > vw + 1) {
    add('overflow-x', de, 'page is ' + de.scrollWidth + 'px wide in a ' + vw + 'px viewport', { key: 'doc' })
    let c = 0
    for (const e of q('body *')) {
      if (c >= 8) break
      const r = e.getBoundingClientRect()
      if (r.right <= vw + 1 || r.width < 2 || e.closest(EXCL) || !visible(e, true)) continue
      let ok = true
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = cs(p)
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.getBoundingClientRect().right <= vw + 1) { ok = false; break }
        if (p.__off) { ok = false; break }
      }
      if (!ok) continue
      e.__off = true
      add('overflow-x', e, e.textContent, { key: 'el', value: Math.round(r.right - vw) + 'px over' })
      c++
    }
  }

  // small buttons with an icon
  for (const b of q('button, a')) {
    const cn = String(b.className)
    if (cn.indexOf('button--sm') < 0 || cn.indexOf('toggle-button') >= 0) continue
    if (!b.querySelector('svg') || !visible(b)) continue
    add(cn.indexOf('icon-only') >= 0 ? 'btn-sm-icon-only' : 'btn-sm-icon', b, b.innerText || b.getAttribute('aria-label'))
  }

  // more than one primary button in the viewport
  const prim = q('.button--primary').filter((b) => {
    if (b.closest('.starci-core-tabs-more, .starci-core-top-bar, .starci-core-sidebar, .starci-core-avatar-button-floating, .starci-core-workspace-shell-compact-header')) return false
    if (!visible(b)) return false
    const r = b.getBoundingClientRect()
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
  })
  if (prim.length > 1) for (const b of prim) add('multi-primary', b, (b.innerText || b.getAttribute('aria-label') || '') + ' (1 of ' + prim.length + ')', { count: prim.length })
  return { findings: out, meta }
}
