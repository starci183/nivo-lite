import type { PickBadgeView } from "@/modules/types"
import {
    FACT_MAP_KINDS,
    factMapCountsOf,
    factMapDocumentsOf,
    factVisibleTo,
    type FactMapDocument,
    type FactMapRef,
} from "./fact-map"
import type { FactDrawerWords } from "./fact-drawers"
import { trustBadgeOf, valueOf } from "./fact-pick"
import type { FactKey, FactKeyKind } from "./inbox"
import type { AgentLens } from "./lenses"

/** The words of the side pane of the map, besides those of the fact drawer. */
export interface FactMapPaneWords {
    readonly drawer: FactDrawerWords
    readonly documentsTitle: string
    readonly readersTitle: string
    readonly customerName: string
    readonly approve: string
    readonly edit: string
    readonly compare: string
    readonly kindLabel: (kind: FactKeyKind, count: number) => string
}

/** One agent that reads the selected node. */
export interface FactMapReader {
    readonly id: string
    readonly name: string
    readonly line: string
}

/** What the side pane of the map draws for the selected node. */
export interface FactMapPaneView {
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<PickBadgeView>
    readonly value: { readonly label: string; readonly text: string } | null
    readonly documentsTitle: string
    readonly documents: ReadonlyArray<FactMapDocument>
    readonly readersTitle: string
    readonly readers: ReadonlyArray<FactMapReader>
    /** Duyet: the one waiting value is applied. */
    readonly approve: { readonly label: string; readonly isPending: boolean } | null
    readonly edit: { readonly label: string } | null
    /** A key with competing values opens the comparison. */
    readonly compare: { readonly label: string } | null
}

/** What the side pane is read against. */
export interface FactMapPaneInput {
    readonly ref: FactMapRef | null
    readonly keys: ReadonlyArray<FactKey>
    readonly lenses: ReadonlyArray<AgentLens>
    readonly canWrite: boolean
    readonly isPending: boolean
    readonly words: FactMapPaneWords
}

const KIND_TONE: Readonly<Record<FactKeyKind, PickBadgeView["tone"]>> = {
    settled: "success",
    fresh: "warning",
    conflict: "danger",
    retired: "muted",
}

const readersOf = (one: FactKey, input: FactMapPaneInput): ReadonlyArray<FactMapReader> =>
    input.lenses
        .filter((lens) => factVisibleTo(one.lead, lens))
        .map((lens) => ({
            id: lens.id,
            name: lens.name ?? input.words.customerName,
            line: input.words.drawer.audienceOf(lens.audience),
        }))

const subjectPaneOf = (subjectKey: string, input: FactMapPaneInput): FactMapPaneView | null => {
    const group = input.keys.filter((one) => one.lead.subjectKey === subjectKey && one.kind !== "retired")
    const first = group[0]
    if (first === undefined) return null
    const counts = factMapCountsOf(group)
    const docs = new Map(group.flatMap((one) => factMapDocumentsOf(one)).map((doc) => [doc.id, doc]))
    return {
        title: first.lead.subjectLabel,
        description: input.words.drawer.typeOf(first.lead.subjectType),
        badges: FACT_MAP_KINDS.filter((kind) => counts[kind] > 0).map((kind) => ({
            label: input.words.kindLabel(kind, counts[kind]),
            tone: KIND_TONE[kind],
        })),
        value: null,
        documentsTitle: input.words.documentsTitle,
        documents: [...docs.values()],
        readersTitle: input.words.readersTitle,
        readers: [],
        approve: null,
        edit: null,
        compare: null,
    }
}

const factPaneOf = (key: string, input: FactMapPaneInput): FactMapPaneView | null => {
    const one = input.keys.find((each) => each.key === key)
    if (one === undefined) return null
    const { lead } = one
    const { words } = input
    return {
        title: `${lead.subjectLabel} · ${lead.attributeLabel}`,
        description: words.drawer.typeOf(lead.subjectType),
        badges: [
            {
                label: one.kind === "settled" ? words.drawer.statusActive : words.drawer.statusWaiting,
                tone: KIND_TONE[one.kind],
            },
            trustBadgeOf(lead, words.drawer.pick),
        ],
        value: { label: words.drawer.valueLabel, text: valueOf(lead) },
        documentsTitle: words.documentsTitle,
        documents: factMapDocumentsOf(one),
        readersTitle: words.readersTitle,
        readers: readersOf(one, input),
        approve:
            input.canWrite && one.kind === "fresh" ? { label: words.approve, isPending: input.isPending } : null,
        edit: input.canWrite && lead.proposalKind === "set" ? { label: words.edit } : null,
        compare: input.canWrite && one.kind === "conflict" ? { label: words.compare } : null,
    }
}

/** The side pane of the selected node: a subject with its facts by state, or a fact with its value, documents and readers. */
export const factMapPaneOf = (input: FactMapPaneInput): FactMapPaneView | null => {
    const { ref } = input
    if (ref === null) return null
    if (ref.kind === "subject") return subjectPaneOf(ref.subjectKey, input)
    return factPaneOf(ref.key, input)
}
