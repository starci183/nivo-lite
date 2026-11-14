import { bubbleDiameter, type BubbleMapEdge, type BubbleMapNode, type BubbleMapRingPart } from "@starci/grammar/common"
import type { BrainFact } from "@/modules/types"
import { documentsOfFact, type FactKey, type FactKeyKind } from "./inbox"
import type { AgentLens } from "./lenses"

/** The centre of the map: the shop, which every subject hangs from. */
export const FACT_MAP_ROOT_ID = "root"

/** The view that reads the whole shop: nothing is dimmed. */
export const FACT_MAP_SHOP_VIEW = "shop"

/** The tone each state of a key wears on the status ring: in use is success, waiting a warning, a choice to make a danger. */
export const FACT_MAP_KIND_TONE: Readonly<Record<Exclude<FactKeyKind, "retired">, "success" | "warning" | "danger">> = {
    settled: "success",
    fresh: "warning",
    conflict: "danger",
}

/** The states the ring draws, in the order its arcs run. */
export const FACT_MAP_KINDS: ReadonlyArray<Exclude<FactKeyKind, "retired">> = ["settled", "fresh", "conflict"]

/** What a node of the map stands for. */
export type FactMapRef =
    | { readonly kind: "subject"; readonly subjectKey: string }
    | { readonly kind: "fact"; readonly key: string }
    | { readonly kind: "document"; readonly key: string; readonly documentId: string }

/** The nodes and edges of the map, with what each node id stands for. */
export interface FactMapGraph {
    readonly nodes: ReadonlyArray<BubbleMapNode>
    readonly edges: ReadonlyArray<BubbleMapEdge>
    readonly refs: ReadonlyMap<string, FactMapRef>
}

/** The words the centre of the map is drawn with. */
export interface FactMapWords {
    readonly root: string
    readonly rootMeta: string
}

/** One document a key cites. */
export interface FactMapDocument {
    readonly id: string
    readonly title: string
}

/**
 * Whether a fact is visible to a view: the same rule as the back end's `visibleTo`. A fact bound to an installation is read by that
 * installation only; a public fact by everyone; an internal one by the internal views; a restricted one by the internal views of the
 * modules it names.
 */
export const factVisibleTo = (fact: BrainFact, lens: AgentLens): boolean => {
    if (fact.installationId !== null && fact.installationId !== lens.installationId) return false
    if (fact.scope === "public") return true
    if (lens.audience !== "internal") return false
    return fact.scope === "internal" || (lens.module !== null && fact.modules.includes(lens.module))
}

/** The documents the values of a key cite, each once, in the order the evidence lists them. */
export const factMapDocumentsOf = (one: FactKey): ReadonlyArray<FactMapDocument> => {
    const seen = new Map<string, FactMapDocument>()
    const facts = [one.lead, ...one.options, ...(one.current === null ? [] : [one.current])]
    for (const fact of facts) {
        for (const doc of documentsOfFact(fact)) if (!seen.has(doc.id)) seen.set(doc.id, doc)
    }
    return [...seen.values()]
}

/** A key is on the map while it is in use or waiting. */
export const isMapped = (one: FactKey): boolean => one.kind !== "retired"

const subjectId = (subjectKey: string): string => `subject:${subjectKey}`
/** The id of the node of a key. */
export const factNodeId = (key: string): string => `fact:${key}`
const documentNodeId = (key: string, documentId: string): string => `doc:${key}\u0000${documentId}`

const ROOT_DIAMETER = 124
const SUBJECT_RANGE = { min: 64, max: 104 } as const
/** Every fact draws the same size: the brain keeps no count of how often an agent used a fact. */
const FACT_DIAMETER = 30

const ringOf = (keys: ReadonlyArray<FactKey>): ReadonlyArray<BubbleMapRingPart> =>
    FACT_MAP_KINDS.map((kind) => ({
        tone: FACT_MAP_KIND_TONE[kind],
        value: keys.filter((one) => one.kind === kind).length,
    })).filter((part) => part.value > 0)

/** The keys grouped by subject, in the order the subjects first appear. */
const bySubject = (keys: ReadonlyArray<FactKey>): ReadonlyMap<string, ReadonlyArray<FactKey>> => {
    const groups = new Map<string, FactKey[]>()
    for (const one of keys) groups.set(one.lead.subjectKey, [...(groups.get(one.lead.subjectKey) ?? []), one])
    return groups
}

/**
 * The map of the shop's brain for the orbit layout: the shop in the centre; the subjects on the first ring, named and ringed by the
 * states of their facts; the facts on the second ring as small bubbles, each with a status ring and named on hover; and, while a
 * fact is open, the documents it cites as small rectangles on the outer ring. A view dims every fact its agent cannot read, with
 * the subject that holds none of them: nothing leaves the map.
 */
export const factMapGraphOf = (
    keys: ReadonlyArray<FactKey>,
    words: FactMapWords,
    view: AgentLens | null,
): FactMapGraph => {
    const shown = keys.filter((entry) => isMapped(entry))
    const groups = bySubject(shown)
    const maxGroup = Math.max(1, ...[...groups.values()].map((group) => group.length))
    const refs = new Map<string, FactMapRef>()
    const edges: BubbleMapEdge[] = []
    const isOut = (one: FactKey): boolean => view !== null && !factVisibleTo(one.lead, view)
    const nodes: BubbleMapNode[] = [
        {
            id: FACT_MAP_ROOT_ID,
            label: words.root,
            description: words.rootMeta,
            isRoot: true,
            form: "bubble",
            caption: words.root,
            detail: words.rootMeta,
            diameter: ROOT_DIAMETER,
            tone: "accent",
            fill: "solid",
        },
    ]
    for (const [subjectKey, group] of groups) {
        const id = subjectId(subjectKey)
        const label = group[0]?.lead.subjectLabel ?? subjectKey
        refs.set(id, { kind: "subject", subjectKey })
        nodes.push({
            id,
            label,
            form: "bubble",
            caption: label,
            diameter: bubbleDiameter(group.length, maxGroup, SUBJECT_RANGE),
            tone: "neutral",
            fill: "soft",
            ring: ringOf(group),
            isDimmed: group.every((entry) => isOut(entry)),
        })
        edges.push({ id: `${FACT_MAP_ROOT_ID}>${id}`, source: FACT_MAP_ROOT_ID, target: id })
        for (const one of group) {
            const factId = factNodeId(one.key)
            const isDimmed = isOut(one)
            const tone = FACT_MAP_KIND_TONE[one.kind === "retired" ? "settled" : one.kind]
            refs.set(factId, { kind: "fact", key: one.key })
            nodes.push({
                id: factId,
                label: `${one.lead.attributeLabel}: ${one.lead.value}`,
                form: "bubble",
                diameter: FACT_DIAMETER,
                tone: "neutral",
                fill: "soft",
                ring: [{ tone, value: 1 }],
                isDimmed,
            })
            edges.push({ id: `${id}>${factId}`, source: id, target: factId })
            for (const doc of factMapDocumentsOf(one)) {
                const docId = documentNodeId(one.key, doc.id)
                refs.set(docId, { kind: "document", key: one.key, documentId: doc.id })
                nodes.push({ id: docId, label: doc.title, shape: "rect", size: "sm", tone: "muted", isDimmed })
                edges.push({ id: `${factId}>${docId}`, source: factId, target: docId })
            }
        }
    }
    return { nodes, edges, refs }
}

/** The node a click should select: a document stands for the fact that cites it. */
export const factMapSelectionIdOf = (graph: FactMapGraph, id: string | null): string | null => {
    if (id === null) return null
    const ref = graph.refs.get(id)
    return ref?.kind === "document" ? factNodeId(ref.key) : id
}

/** How many keys stand at each state, for the legend and the counts of a subject. */
export const factMapCountsOf = (keys: ReadonlyArray<FactKey>): Readonly<Record<FactKeyKind, number>> => ({
    settled: keys.filter((one) => one.kind === "settled").length,
    fresh: keys.filter((one) => one.kind === "fresh").length,
    conflict: keys.filter((one) => one.kind === "conflict").length,
    retired: keys.filter((one) => one.kind === "retired").length,
})
