"use client"

import { useMemo, useState } from "react"
import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { visibleTo, type Fact, type SubjectType } from "@/lib/brain/shared"
import { LEGEND_CLASS, LEGEND_DOT_CLASS, LEGEND_ITEM_CLASS, MAP_FRAME_CLASS, MAP_GRID_CLASS, MAP_SVG_CLASS } from "./classNames"
import { SCOPE_KEY, SCOPE_TONE, dateOf, sourceLabel, subjectsOf, typeLabel, type Lens, type Subject } from "./shared"

/** Props for {@link MapPanel}. */
export type MapPanelProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly lens: Lens | null
  /** Offered on the empty map (owners and managers): opens the add-fact drawer. */
  readonly onAdd?: () => void
}

/**
 * The brain at a glance (grammar gap: Grammar has no bubble chart, so this is the app's own SVG, painted only with semantic tokens).
 * Clusters = subject kinds, size = number of facts, colour = what needs attention (conflict, waiting, fine, nothing visible through the lens).
 * Not an embedding projection: every position and size means something the owner can act on.
 */
const W = 640
const H = 420
const MAX_PER_KIND = 12
const KIND_ORDER: ReadonlyArray<SubjectType> = ["business", "service", "product", "policy", "customer", "supplier", "person", "place", "other"]

type Health = "conflict" | "pending" | "ok" | "hidden"
const FILL: Readonly<Record<Health, string>> = { conflict: "var(--danger)", pending: "var(--warning)", ok: "var(--success)", hidden: "var(--muted)" }

type Bubble = { key: string; label: string; type: SubjectType; subjects: ReadonlyArray<Subject>; x: number; y: number; r: number; health: Health; seen: number; total: number }

const healthOf = (subjects: ReadonlyArray<Subject>, lens: Lens | null): { health: Health; seen: number; total: number } => {
  const facts = subjects.flatMap((s) => s.active)
  const seen = lens ? facts.filter((f) => visibleTo(f, lens.audience, lens.module)).length : facts.length
  const conflict = subjects.some((s) => s.proposed.some((p) => s.active.some((a) => a.attribute === p.attribute)))
  const pending = subjects.some((s) => s.proposed.length > 0)
  const health: Health = lens && seen === 0 ? "hidden" : conflict ? "conflict" : pending ? "pending" : "ok"
  return { health, seen, total: facts.length }
}

const LABEL_ROOM = 20 // the name under each bubble

/** The first point on a spiral around (cx, cy) where a circle of radius r touches no placed bubble (or its name). */
const placeFree = (placed: ReadonlyArray<{ x: number; y: number; r: number }>, cx: number, cy: number, r: number): { x: number; y: number } => {
  for (let i = 0; i < 400; i++) {
    const a = i * 0.5
    const d = i * 3
    const x = Math.min(W - r - 4, Math.max(r + 4, cx + Math.cos(a) * d))
    const y = Math.min(H - r - LABEL_ROOM, Math.max(r + 4, cy + Math.sin(a) * d * 0.8))
    if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + LABEL_ROOM)) return { x, y }
  }
  return { x: cx, y: cy }
}

/** Clusters around the centre, one per kind; each bubble takes the first free spot near its cluster, so nothing overlaps or moves between renders. */
const layout = (subjects: ReadonlyArray<Subject>, lens: Lens | null, groupLabel: (t: SubjectType, n: number) => string): Array<Bubble> => {
  const kinds = KIND_ORDER.filter((k) => subjects.some((s) => s.type === k))
  const out: Array<Bubble> = []
  kinds.forEach((kind, ki) => {
    const angle = (ki / Math.max(kinds.length, 1)) * Math.PI * 2 - Math.PI / 2
    const ring = kinds.length > 1 ? 140 : 0
    const cx = W / 2 + Math.cos(angle) * ring
    const cy = H / 2 + Math.sin(angle) * ring * 0.72
    const members = subjects.filter((s) => s.type === kind)
    const items: Array<{ key: string; label: string; subjects: ReadonlyArray<Subject> }> = members.length > MAX_PER_KIND
      ? [{ key: `group:${kind}`, label: groupLabel(kind, members.length), subjects: members }]
      : members.map((s) => ({ key: s.key, label: s.label, subjects: [s] }))
    for (const it of items) {
      const facts = it.subjects.reduce((n, s) => n + s.active.length + s.proposed.length, 0)
      const r = Math.min(46, 14 + Math.sqrt(facts) * 8)
      out.push({ ...it, type: kind, r, ...placeFree(out, cx, cy, r), ...healthOf(it.subjects, lens) })
    }
  })
  return out
}

export const MapPanel = ({ facts, lens, onAdd }: MapPanelProps) => {
  const t = useT(brain)
  const locale = useLocale()
  const subjects = useMemo(() => subjectsOf(facts), [facts])
  const bubbles = useMemo(() => layout(subjects, lens, (k, n) => `${typeLabel(t, k)} (${n})`), [subjects, lens, t])
  const [selected, setSelected] = useState<string | null>(null)
  const current = bubbles.find((b) => b.key === selected) ?? bubbles.find((b) => b.health === "conflict") ?? bubbles[0]

  if (!bubbles.length) return <EmptyNotice message={t("mapEmptyTitle")} description={t("mapEmptyBody")} actionLabel={onAdd ? t("emptyAction") : undefined} onAction={onAdd} />
  return (
    <div className={MAP_GRID_CLASS}>
      <div className={MAP_FRAME_CLASS}>
        <svg viewBox={`0 0 ${W} ${H}`} className={MAP_SVG_CLASS} role="img" aria-label={t("mapAria")}>
          {bubbles.map((b) => {
            const on = b.key === current?.key
            const choose = () => setSelected(b.key)
            return (
              <g key={b.key} role="button" tabIndex={0} aria-label={`${b.label}: ${t("seenBy", { n: String(b.seen), total: String(b.total) })}`} aria-pressed={on}
                onClick={choose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose() } }} style={{ cursor: "pointer", outline: "none" }}>
                <circle cx={b.x} cy={b.y} r={b.r} fill={FILL[b.health]} fillOpacity={b.health === "hidden" ? 0.12 : on ? 0.9 : 0.55}
                  stroke={on ? "var(--foreground)" : FILL[b.health]} strokeWidth={on ? 2 : 1} strokeDasharray={b.health === "hidden" ? "4 4" : undefined} />
                <text x={b.x} y={b.y + 4} textAnchor="middle" fontSize={12} fill="var(--foreground)" style={{ pointerEvents: "none" }}>{lens ? `${b.seen}/${b.total}` : b.total}</text>
                <text x={b.x} y={b.y + b.r + 14} textAnchor="middle" fontSize={12} fill={b.health === "hidden" ? "var(--muted)" : "var(--foreground)"} style={{ pointerEvents: "none" }}>
                  {b.label.length > 22 ? `${b.label.slice(0, 21)}…` : b.label}
                </text>
              </g>
            )
          })}
        </svg>
        <div className={LEGEND_CLASS}>
          {(["ok", "pending", "conflict", "hidden"] as const).map((h) => (
            <span key={h} className={LEGEND_ITEM_CLASS}>
              <span className={LEGEND_DOT_CLASS} style={{ background: FILL[h] }} aria-hidden="true" />
              <Text size="xs" tone="muted">{t(h === "ok" ? "legendOk" : h === "pending" ? "legendPending" : h === "conflict" ? "legendConflict" : "legendEmpty")}</Text>
            </span>
          ))}
        </div>
      </div>
      {current ? (
        <SurfaceListCard label={current.label} headingLevel={2} labelEnd={<Badge tone="neutral">{typeLabel(t, current.type)}</Badge>}>
          {current.subjects.flatMap((s) => [
            ...s.active.map((f) => {
              const seen = !lens || visibleTo(f, lens.audience, lens.module)
              return (
                <ListRow key={f.id} title={current.subjects.length > 1 ? `${s.label} · ${f.attributeLabel}` : f.attributeLabel}
                  description={`${sourceLabel(t, f.sourceKind)} · ${f.decidedBy ?? f.proposedBy}`}
                  badges={<Badge tone={SCOPE_TONE[f.scope]}>{t(SCOPE_KEY[f.scope])}</Badge>} state={seen ? undefined : "unavailable"}>
                  <Text size="sm" weight={seen ? "semibold" : undefined} tone={seen ? undefined : "muted"}>{seen ? f.value : t("hiddenValue")}</Text>
                </ListRow>
              )
            }),
            ...s.scheduled.map((f) => (
              <ListRow key={f.id} title={`${s.label} · ${f.attributeLabel}`} description={`${sourceLabel(t, f.sourceKind)} · ${f.decidedBy ?? f.proposedBy}`}
                badges={<Badge tone="accent">{t("scheduledBadge", { date: dateOf(f.validFrom, locale) })}</Badge>}>
                <Text size="sm">{f.value}</Text>
              </ListRow>
            )),
            ...s.proposed.map((p) => (
              <ListRow key={p.id} title={`${s.label} · ${p.attributeLabel}`} description={`${sourceLabel(t, p.sourceKind)} · ${p.proposedBy}`}
                badges={<Badge tone={s.active.some((a) => a.attribute === p.attribute) ? "danger" : "warning"}>{s.active.some((a) => a.attribute === p.attribute) ? t("legendConflict") : t("legendPending")}</Badge>}>
                <Text size="sm">{t("newValue", { value: p.value })}</Text>
              </ListRow>
            )),
          ])}
        </SurfaceListCard>
      ) : null}
    </div>
  )
}
