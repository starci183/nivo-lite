import { foldedText, type Evidence, type FactRecord, type FactRelation } from "@modules/domain/brain-facts"
import type { ExtractionProgressView } from "@modules/domain/brain-extractions"
import type {
    BrainGraph,
    BrainGraphFilter,
    BrainGraphNode,
    BrainGraphOrigin,
    BrainGraphPending,
    BrainGraphSource,
} from "./brain.contracts"

/** How many subjects one page of the graph holds when the caller does not say. */
export const GRAPH_SUBJECTS_DEFAULT: number = 30

/** The most subjects one page holds. */
export const GRAPH_SUBJECTS_MAX: number = 100

/** How long a change counts as recent ("1 nut vua doi"), in milliseconds: seven days. */
export const RECENT_MS: number = 7 * 24 * 60 * 60 * 1000

/** Where a fact or a proposal comes from, as the graph shows it: its newest piece of evidence. */
export const originOf = (evidence: ReadonlyArray<Evidence>): BrainGraphOrigin => {
    const item = evidence.at(-1)
    if (item === undefined) return { kind: "other", label: "", quote: null, sourceId: null, chunkHash: null, messageId: null }
    const base = { label: item.label, quote: item.quote ?? null }
    if (item.kind === "document") {
        return {
            ...base,
            kind: "document",
            label: item.title ?? item.label,
            sourceId: item.sourceId ?? item.ref,
            chunkHash: item.chunkHash ?? null,
            messageId: null,
        }
    }
    if (item.kind === "message" && item.ref.startsWith("team-chat:")) {
        return {
            ...base,
            kind: "chat",
            sourceId: null,
            chunkHash: null,
            messageId: item.ref.slice("team-chat:".length),
        }
    }
    return {
        ...base,
        kind: item.kind === "manual" ? "manual" : "other",
        sourceId: null,
        chunkHash: null,
        messageId: null,
    }
}

/** Whether a fact matches the words of a search (every word, accents ignored, in its subject, attribute or value). */
const matches = (fact: FactRecord, words: ReadonlyArray<string>): boolean => {
    const text = foldedText(`${fact.subjectLabel} ${fact.attributeLabel} ${fact.value}`)
    return words.every((word) => text.includes(word))
}

/** One page of subjects and the cursor of the next. */
export interface SubjectPage {
    /** The subject keys of the page, in key order. */
    readonly subjects: ReadonlyArray<string>
    /** The cursor of the next page, or null. */
    readonly nextCursor: string | null
}

/** The order of subject keys. */
const byKey = (a: string, b: string): number => a.localeCompare(b)

/** The subjects of one page: in key order, after the cursor, at most `limit`; and the cursor of the next page. */
export const subjectPageOf = (facts: ReadonlyArray<FactRecord>, filter: BrainGraphFilter): SubjectPage => {
    const words = foldedText(filter.query ?? "")
        .split(" ")
        .filter((word) => word.length > 0)
    const wanted = facts.filter(
        (fact) =>
            (filter.subjectKey === undefined || fact.subjectKey === filter.subjectKey) &&
            (words.length === 0 || matches(fact, words)),
    )
    const all = [...new Set(wanted.map((fact) => fact.subjectKey))].sort(byKey)
    const cursor = filter.cursor
    const after = cursor === undefined ? all : all.filter((key) => byKey(key, cursor) > 0)
    const limit = Math.min(Math.max(filter.limit ?? GRAPH_SUBJECTS_DEFAULT, 1), GRAPH_SUBJECTS_MAX)
    const subjects = after.slice(0, limit)
    return { subjects, nextCursor: after.length > limit ? (subjects.at(-1) ?? null) : null }
}

/** One node of the graph: a truth with its source, version, validity and the value it replaced. */
export const nodeOf = (
    fact: FactRecord,
    previous: FactRecord | undefined,
    pending: number,
    nowMs: number,
    neighbor: boolean,
): BrainGraphNode => ({
    id: fact.id,
    subjectKey: fact.subjectKey,
    subjectLabel: fact.subjectLabel,
    subjectType: fact.subjectType,
    attributeLabel: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    status: fact.status,
    version: fact.version ?? null,
    validFrom: fact.validFrom,
    validTo: fact.validTo,
    scope: fact.scope,
    modules: fact.modules,
    installationId: fact.installationId,
    origin: originOf(fact.evidence),
    previous:
        previous === undefined ? null : { id: previous.id, value: previous.value, version: previous.version ?? null },
    changedAt: fact.decidedAt,
    recentlyChanged: fact.decidedAt !== null && nowMs - Date.parse(fact.decidedAt) < RECENT_MS,
    pendingCount: pending,
    neighbor,
})

/** One waiting change request as the graph's aside shows it, with the value in force it would replace. */
export const pendingOf = (proposal: FactRecord, current: FactRecord | undefined): BrainGraphPending => ({
    id: proposal.id,
    subjectKey: proposal.subjectKey,
    subjectLabel: proposal.subjectLabel,
    attributeLabel: proposal.attributeLabel,
    value: proposal.value,
    unit: proposal.unit,
    proposalKind: proposal.proposalKind,
    currentFactId: current?.id ?? null,
    currentValue: current?.value ?? null,
    currentVersion: current?.version ?? null,
    proposedBy: proposal.proposedBy,
    proposedAt: proposal.proposedAt,
    sourceKind: proposal.sourceKind,
    origin: originOf(proposal.evidence),
    validFrom: proposal.validFrom,
    validTo: proposal.validTo,
    flags: proposal.flags ?? [],
    conflictWith: proposal.conflictWith,
})

/** The documents the graph was built from, with how many truths in force each one supports and how far its reading got. */
export const sourcesOf = (
    facts: ReadonlyArray<FactRecord>,
    readings: ReadonlyArray<ExtractionProgressView>,
): ReadonlyArray<BrainGraphSource> => {
    const bySource = new Map<string, { title: string; nodes: number; lastAt: string | null }>()
    for (const fact of facts) {
        const seen = new Set<string>()
        for (const item of fact.evidence) {
            const sourceId = item.kind === "document" ? (item.sourceId ?? item.ref) : null
            if (sourceId === null || seen.has(sourceId)) continue
            seen.add(sourceId)
            const entry = bySource.get(sourceId) ?? { title: item.title ?? item.label, nodes: 0, lastAt: null }
            const at = fact.decidedAt
            bySource.set(sourceId, {
                title: entry.title,
                nodes: entry.nodes + 1,
                lastAt: at !== null && (entry.lastAt === null || at > entry.lastAt) ? at : entry.lastAt,
            })
        }
    }
    const reading = new Map(readings.map((row) => [row.sourceId, row]))
    return [...bySource.entries()]
        .map(([sourceId, entry]) => {
            const row = reading.get(sourceId)
            return {
                sourceId,
                title: entry.title,
                nodeCount: entry.nodes,
                lastChangedAt: entry.lastAt,
                reading:
                    row === undefined
                        ? null
                        : {
                              status: row.status,
                              windowsDone: row.windowsDone,
                              windowsTotal: row.windowsTotal,
                              factsProposed: row.factsProposed,
                          },
            }
        })
        .sort((a, b) => (b.lastChangedAt ?? "").localeCompare(a.lastChangedAt ?? "") || a.title.localeCompare(b.title))
}

/** The SQL counts of the whole workspace behind a capped graph read. */
export interface BrainGraphCounts {
    /** Truths in force or scheduled. */
    readonly nodes: number
    /** Waiting proposals. */
    readonly pending: number
}

/** The parts the graph read gathered. */
export interface GraphParts {
    /** The truths in force or scheduled of the workspace. */
    readonly facts: ReadonlyArray<FactRecord>
    /** The waiting proposals of the workspace. */
    readonly proposals: ReadonlyArray<FactRecord>
    /** The values the page's truths replaced, by id. */
    readonly previous: ReadonlyMap<string, FactRecord>
    /** The edges touching the page's truths. */
    readonly relations: ReadonlyArray<FactRelation>
    /** How far each document's reading got. */
    readonly readings: ReadonlyArray<ExtractionProgressView>
    /** How many edges the workspace has among its truths in force. */
    readonly relationTotal: number
    /**
     * The SQL counts of the whole workspace (truths in force or scheduled, waiting proposals), when the read is capped: the totals say
     * the real numbers and how many are not shown. Absent: the parts are the whole graph.
     */
    readonly counts?: BrainGraphCounts
}

/**
 * The graph one page shows: the truths of the page's subjects and, one hop away, the truths their edges reach (marked as
 * neighbours); the edges among them; every waiting change request (the aside lists them all); the source documents; the totals.
 */
export const graphOf = (
    parts: GraphParts,
    page: SubjectPage,
    nowMs: number,
): BrainGraph => {
    const inPage = new Set(page.subjects)
    const byId = new Map(parts.facts.map((fact) => [fact.id, fact]))
    const own = parts.facts.filter((fact) => inPage.has(fact.subjectKey))
    const ownIds = new Set(own.map((fact) => fact.id))
    const edges = parts.relations.filter((edge) => byId.has(edge.fromFactId) && byId.has(edge.toFactId))
    const neighborIds = new Set(
        edges.flatMap((edge) => [edge.fromFactId, edge.toFactId]).filter((id) => !ownIds.has(id)),
    )
    const waitingByKey = new Map<string, number>()
    for (const proposal of parts.proposals) {
        const key = `${proposal.subjectKey}|${proposal.attribute}`
        waitingByKey.set(key, (waitingByKey.get(key) ?? 0) + 1)
    }
    const node = (fact: FactRecord, neighbor: boolean) =>
        nodeOf(
            fact,
            fact.supersedesId === null ? undefined : parts.previous.get(fact.supersedesId),
            waitingByKey.get(`${fact.subjectKey}|${fact.attribute}`) ?? 0,
            nowMs,
            neighbor,
        )
    const nodes = [
        ...own.map((fact) => node(fact, false)),
        ...[...neighborIds].flatMap((id) => {
            const fact = byId.get(id)
            return fact === undefined ? [] : [node(fact, true)]
        }),
    ]
    const shown = new Set(nodes.map((entry) => entry.id))
    const active = new Map(parts.facts.filter((fact) => fact.status === "active").map((fact) => [fact.id, fact]))
    const activeByKey = new Map([...active.values()].map((fact) => [`${fact.subjectKey}|${fact.attribute}`, fact]))
    return {
        nodes,
        edges: edges.filter((edge) => shown.has(edge.fromFactId) && shown.has(edge.toFactId)),
        pending: parts.proposals.map((proposal) =>
            pendingOf(proposal, activeByKey.get(`${proposal.subjectKey}|${proposal.attribute}`)),
        ),
        sources: sourcesOf(parts.facts, parts.readings),
        totals: {
            nodes: Math.max(parts.counts?.nodes ?? 0, parts.facts.length),
            relations: parts.relationTotal,
            recentlyChanged: parts.facts.filter(
                (fact) => fact.decidedAt !== null && nowMs - Date.parse(fact.decidedAt) < RECENT_MS,
            ).length,
            pending: Math.max(parts.counts?.pending ?? 0, parts.proposals.length),
            nodesNotShown: Math.max(0, (parts.counts?.nodes ?? 0) - parts.facts.length),
            pendingNotShown: Math.max(0, (parts.counts?.pending ?? 0) - parts.proposals.length),
        },
        nextCursor: page.nextCursor,
    }
}
