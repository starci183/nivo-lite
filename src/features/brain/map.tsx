"use client"

import { useMemo, useState } from "react"
import { Badge, Divider, EmptyNotice, FlowGraph, ListRow, SurfaceCard, SurfaceListCard, Text, type FlowGraphEdge, type FlowGraphNode, type FlowGraphTone } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { visibleTo, type Fact, type SubjectType } from "@/lib/brain/shared"
import { LEGEND_CLASS, MAP_EMPTY_BAND_CLASS, MAP_GRID_CLASS } from "./classNames"
import { SCOPE_KEY, SCOPE_TONE, dateOf, sourceLabel, subjectsOf, typeLabel, type BrainDoc, type Lens, type Subject } from "./shared"

/** Props for {@link MapPanel}. */
export type MapPanelProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly documents: ReadonlyArray<BrainDoc>
  readonly lens: Lens | null
  /** The workspace's name: the centre of the graph. */
  readonly business: string
  /** Offered on the empty map (owners and managers): opens the add-documents drawer. */
  readonly onAdd?: () => void
  /** STATE-8: the graph frame as a skeleton, no list under it. */
  readonly isLoading?: boolean
}

type Health = "conflict" | "pending" | "ok" | "hidden"
const TONE: Readonly<Record<Health, FlowGraphTone>> = { conflict: "danger", pending: "warning", ok: "success", hidden: "muted" }
const KIND_ORDER: ReadonlyArray<SubjectType> = ["business", "service", "product", "policy", "customer", "supplier", "person", "place", "other"]
const SUBJECTS_PER_KIND = 6
const TOPICS_SHOWN = 8
const ROOT = "root"
const DOCS = "docs"

const healthOf = (subjects: ReadonlyArray<Subject>, lens: Lens | null): Health => {
  const facts = subjects.flatMap((s) => s.active)
  const seen = lens ? facts.filter((f) => visibleTo(f, lens.audience, lens.module)).length : facts.length
  if (lens && seen === 0) return "hidden"
  if (subjects.some((s) => s.proposed.some((p) => s.active.some((a) => a.attribute === p.attribute)))) return "conflict"
  return subjects.some((s) => s.proposed.length > 0) ? "pending" : "ok"
}
const factCount = (subjects: ReadonlyArray<Subject>) => subjects.reduce((n, s) => n + s.active.length + s.proposed.length + s.scheduled.length, 0)
const topicOf = (d: BrainDoc, other: string) => d.topic?.trim() || other

/**
 * The Second Brain as a graph (Grammar `FlowGraph`, xyflow): the business at the centre, its documents grouped by topic on one
 * branch, and what the brain knows grouped by kind on the others. Tone = what needs the owner (conflict, waiting, fine, hidden
 * through the current agent's lens). Selecting a node lists what it holds under the graph.
 */
export const MapPanel = ({ facts, documents, lens, business, onAdd, isLoading = false }: MapPanelProps) => {
  const t = useT(brain)
  const locale = useLocale()
  const subjects = useMemo(() => subjectsOf(facts), [facts])
  const [selected, setSelected] = useState<string | null>(null)
  const other = t("topicOther")

  const graph = useMemo(() => {
    const nodes: Array<FlowGraphNode> = [{ id: ROOT, label: business, tone: "accent", size: "lg", isRoot: true }]
    const edges: Array<FlowGraphEdge> = []
    const link = (source: string, target: string, isPlaceholder = false) => edges.push({ id: `${source}->${target}`, source, target, isPlaceholder })

    // Documents: one branch, a node per topic.
    const topics = new Map<string, number>()
    for (const d of documents) topics.set(topicOf(d, other), (topics.get(topicOf(d, other)) ?? 0) + 1)
    nodes.push({ id: DOCS, label: t("statDocs"), count: documents.length, tone: documents.length ? "neutral" : "muted", size: "md", isPlaceholder: documents.length === 0 })
    link(ROOT, DOCS, documents.length === 0)
    for (const [topic, n] of [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOPICS_SHOWN)) {
      nodes.push({ id: `topic:${topic}`, label: topic, count: n, tone: "neutral", size: "sm" })
      link(DOCS, `topic:${topic}`)
    }

    // What the brain knows: a branch per kind, its main subjects around it.
    const kinds = KIND_ORDER.filter((k) => subjects.some((s) => s.type === k))
    for (const kind of kinds) {
      const members = subjects.filter((s) => s.type === kind)
      nodes.push({ id: `kind:${kind}`, label: typeLabel(t, kind), count: factCount(members), tone: TONE[healthOf(members, lens)], size: "md" })
      link(ROOT, `kind:${kind}`)
      for (const s of [...members].sort((a, b) => factCount([b]) - factCount([a])).slice(0, SUBJECTS_PER_KIND)) {
        nodes.push({ id: `subj:${s.key}`, label: s.label, count: factCount([s]), tone: TONE[healthOf([s], lens)], size: "sm" })
        link(`kind:${kind}`, `subj:${s.key}`)
      }
    }
    // Nothing known yet: the first kinds wait as placeholders, so the shape of the brain is visible from day one.
    if (!kinds.length) {
      for (const kind of ["business", "service", "policy"] as const) {
        nodes.push({ id: `kind:${kind}`, label: typeLabel(t, kind), tone: "muted", size: "md", isPlaceholder: true })
        link(ROOT, `kind:${kind}`, true)
      }
    }
    return { nodes, edges }
  }, [business, documents, subjects, lens, t, other])

  const isEmpty = !isLoading && facts.length === 0 && documents.length === 0
  const focus = selected ?? (subjects.some((s) => healthOf([s], lens) === "conflict") ? `kind:${subjects.find((s) => healthOf([s], lens) === "conflict")?.type}` : null)
  const chosenSubjects = focus?.startsWith("kind:") ? subjects.filter((s) => s.type === focus.slice(5))
    : focus?.startsWith("subj:") ? subjects.filter((s) => s.key === focus.slice(5))
    : []
  const chosenDocs = focus === DOCS ? documents : focus?.startsWith("topic:") ? documents.filter((d) => topicOf(d, other) === focus.slice(6)) : []
  const title = graph.nodes.find((n) => n.id === focus)?.label

  return (
    <div className={MAP_GRID_CLASS}>
      <SurfaceCard ariaLabel={t("mapAria")} composition="joined">
        <FlowGraph isLoading={isLoading} label={t("mapAria")} nodes={graph.nodes} edges={graph.edges} selectedId={focus} onSelect={setSelected} height="lg" />
        {isLoading ? null : <Divider semantics="presentation" />}
        {isLoading ? null : isEmpty ? (
          <div className={MAP_EMPTY_BAND_CLASS}>
            <EmptyNotice message={t("mapEmptyTitle")} description={t("mapEmptyBody")} actionLabel={onAdd ? t("emptyAction") : undefined} onAction={onAdd} />
          </div>
        ) : (
          <div className={LEGEND_CLASS}>
            <Badge tone="success" isDot>{t("legendOk")}</Badge>
            <Badge tone="warning" isDot>{t("legendPending")}</Badge>
            <Badge tone="danger" isDot>{t("legendConflict")}</Badge>
            {lens ? <Badge tone="neutral" isDot>{t("legendEmpty")}</Badge> : null}
          </div>
        )}
      </SurfaceCard>

      {chosenDocs.length ? (
        <SurfaceListCard label={title ?? t("statDocs")} headingLevel={2} fact={t("docsCount", { n: String(chosenDocs.length) })}>
          {chosenDocs.map((d) => (
            <ListRow key={d.id} title={d.title} description={t("docChunks", { n: String(d.chunkCount) })}
              badges={<Badge tone={d.status === "ready" ? "success" : d.status === "failed" ? "danger" : "warning"} isDot>{t(d.status === "ready" ? "docReady" : d.status === "failed" ? "docFailed" : "docIndexing")}</Badge>} />
          ))}
        </SurfaceListCard>
      ) : null}

      {chosenSubjects.length ? (
        <SurfaceListCard label={title ?? ""} headingLevel={2}>
          {chosenSubjects.flatMap((s) => [
            ...s.active.map((f) => {
              const seen = !lens || visibleTo(f, lens.audience, lens.module)
              return (
                <ListRow key={f.id} title={chosenSubjects.length > 1 ? `${s.label} · ${f.attributeLabel}` : f.attributeLabel}
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
            ...s.proposed.map((p) => {
              const clash = s.active.some((a) => a.attribute === p.attribute)
              return (
                <ListRow key={p.id} title={`${s.label} · ${p.attributeLabel}`} description={`${sourceLabel(t, p.sourceKind)} · ${p.proposedBy}`}
                  badges={<Badge tone={clash ? "danger" : "warning"}>{clash ? t("legendConflict") : t("legendPending")}</Badge>}>
                  <Text size="sm">{t("newValue", { value: p.value })}</Text>
                </ListRow>
              )
            }),
          ])}
        </SurfaceListCard>
      ) : null}
    </div>
  )
}
