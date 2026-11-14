import type {
    BrainFact,
    FactPickGroupView,
    FactPickRowView,
    FactSubjectType,
    PickBadgeView,
    PickSelection,
} from "@/modules/types"
import { documentsOfFact, keyDocumentsOf, type FactKey } from "./inbox"
import { trustLevelOf, type TrustLevel } from "./labels"

/** How the rows of a table of facts are grouped: by the document they come from, or by the subject they are about. */
export type PickGrouping = "document" | "subject"

/** The resolved words the rows and groups are made of. */
export interface FactPickWords {
    readonly trustLabel: (level: TrustLevel) => string
    readonly conflictBadge: string
    readonly retiredBadge: string
    /** "10% or 15%": the competing values of a conflict, in one line. */
    readonly valuesOf: (values: ReadonlyArray<string>) => string
    /** "2 documents · different values". */
    readonly conflictSource: (documents: number) => string
    /** "merged 1": values that said the same thing, in the row of the kept one. */
    readonly mergedOf: (count: number) => string
    readonly noDocument: string
    readonly typeOf: (type: FactSubjectType) => string
    /** The one line of a group: how many rows and how far they are believed. */
    readonly groupLine: (rows: number, high: number, medium: number, low: number) => string
    readonly waitingBadge: (count: number) => string
    readonly conflictsBadge: (count: number) => string
    /** The toggle of an open group ("Collapse") and of a closed one ("Show 12"). */
    readonly collapseLabel: string
    readonly expandLabel: (count: number) => string
}

/** One group of keys before it is worded: its id, its title and its keys. */
export interface KeyGroup {
    readonly id: string
    readonly title: string
    readonly keys: ReadonlyArray<FactKey>
}

/** What the keys are grouped by: the grouping, the topic of a document, and the words of the fallbacks. */
export interface GroupInput {
    readonly by: PickGrouping
    readonly topicOf: (sourceId: string) => string | undefined
    readonly words: FactPickWords
}

const TRUST_TONE: Readonly<Record<TrustLevel, PickBadgeView["tone"]>> = {
    high: "success",
    medium: "warning",
    low: "danger",
}

/** The value of a fact as it is read: with its unit. */
export const valueOf = (fact: BrainFact): string => (fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`)

/** The badge of how far a fact is believed. */
export const trustBadgeOf = (fact: BrainFact, words: FactPickWords): PickBadgeView => {
    const level = trustLevelOf(fact.trust)
    return { label: words.trustLabel(level), tone: TRUST_TONE[level] }
}

/** The group a key falls in: its first document, or the topic of that document (the subject type when it has none). */
const groupOf = (one: FactKey, input: GroupInput): { readonly id: string; readonly title: string } => {
    const doc = documentsOfFact(one.lead)[0]
    if (input.by === "document")
        return doc === undefined
            ? { id: "doc:none", title: input.words.noDocument }
            : { id: `doc:${doc.id}`, title: doc.title }
    const topic = doc === undefined ? undefined : input.topicOf(doc.id)
    return topic === undefined
        ? { id: `type:${one.lead.subjectType}`, title: input.words.typeOf(one.lead.subjectType) }
        : { id: `topic:${topic}`, title: topic }
}

/** The keys grouped by document or by subject, the largest group first. */
export const keyGroupsOf = (keys: ReadonlyArray<FactKey>, input: GroupInput): ReadonlyArray<KeyGroup> => {
    const groups = new Map<string, { readonly id: string; readonly title: string; readonly keys: Array<FactKey> }>()
    for (const one of keys) {
        const head = groupOf(one, input)
        const group = groups.get(head.id) ?? { ...head, keys: [] }
        groups.set(head.id, group)
        group.keys.push(one)
    }
    return [...groups.values()].sort((left, right) => right.keys.length - left.keys.length)
}

/** Where the row's value comes from: its documents, and how many values were merged into it. */
const sourceOf = (one: FactKey, words: FactPickWords): string => {
    if (one.kind === "conflict") return words.conflictSource(keyDocumentsOf(one).length)
    const titles = [...new Set(documentsOfFact(one.lead).map((doc) => doc.title))]
    const merged = one.proposals.length - one.options.length
    return [
        titles.length === 0 ? words.noDocument : titles.join(", "),
        ...(merged > 0 ? [words.mergedOf(merged)] : []),
    ].join(" · ")
}

/** The badge of a row: the choice a conflict asks for, or how far the value is believed. */
const badgeOf = (one: FactKey, words: FactPickWords): PickBadgeView => {
    if (one.kind === "conflict") return { label: words.conflictBadge, tone: "warning" }
    if (one.kind === "retired") return { label: words.retiredBadge, tone: "muted" }
    return trustBadgeOf(one.lead, words)
}

/** One row of a key. */
export const pickRowOf = (one: FactKey, words: FactPickWords, selected: ReadonlySet<string>): FactPickRowView => ({
    id: one.key,
    factId: one.lead.id,
    title: `${one.lead.subjectLabel} · ${one.lead.attributeLabel}`,
    source: sourceOf(one, words),
    value: one.kind === "conflict" ? words.valuesOf(one.options.map((entry) => valueOf(entry))) : valueOf(one.lead),
    badge: badgeOf(one, words),
    isConflict: one.kind === "conflict",
    isSettled: one.kind === "settled" || one.kind === "retired",
    isSelected: one.kind === "fresh" && selected.has(one.key),
})

/** Whether every row of a group that can be ticked is, some are, or none. */
const selectionOf = (keys: ReadonlyArray<FactKey>, selected: ReadonlySet<string>): PickSelection => {
    const open = keys.filter((one) => one.kind === "fresh")
    const ticked = open.filter((one) => selected.has(one.key)).length
    if (ticked === 0) return "none"
    return ticked === open.length ? "all" : "some"
}

/** The one line of a group: how many rows, and how far the fresh ones are believed. */
const lineOf = (keys: ReadonlyArray<FactKey>, words: FactPickWords): string => {
    const levels = keys.filter((one) => one.kind === "fresh").map((one) => trustLevelOf(one.lead.trust))
    const count = (level: TrustLevel) => levels.filter((one) => one === level).length
    return words.groupLine(keys.length, count("high"), count("medium"), count("low"))
}

/** The badges of a group: how many rows wait, and how many ask for a choice. */
const groupBadgesOf = (keys: ReadonlyArray<FactKey>, words: FactPickWords): ReadonlyArray<PickBadgeView> => {
    const waiting = keys.filter((one) => one.kind === "fresh").length
    const conflicts = keys.filter((one) => one.kind === "conflict").length
    return [
        ...(waiting > 0 ? [{ label: words.waitingBadge(waiting), tone: "warning" as const }] : []),
        ...(conflicts > 0 ? [{ label: words.conflictsBadge(conflicts), tone: "muted" as const }] : []),
    ]
}

/** What a group draws, from its keys, the ticked keys and whether it is open. */
export const pickGroupOf = (
    group: KeyGroup,
    words: FactPickWords,
    selected: ReadonlySet<string>,
    isOpen: boolean,
): FactPickGroupView => ({
    id: group.id,
    title: group.title,
    line: lineOf(group.keys, words),
    badges: groupBadgesOf(group.keys, words),
    isOpen,
    toggleLabel: isOpen ? words.collapseLabel : words.expandLabel(group.keys.length),
    selection: selectionOf(group.keys, selected),
    isSelectable: group.keys.some((one) => one.kind === "fresh"),
    rows: group.keys.map((one) => pickRowOf(one, words, selected)),
})
