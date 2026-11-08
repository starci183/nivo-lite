import { brainTabHref, workspaceHref } from "@/modules/routes"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type {
    BrainChipView,
    BrainFilterView,
    BrainFact,
    BrainLens,
    FactDetailView,
    FactEntryView,
    FactHistoryView,
    FactScope,
    FactSource,
    FactSubjectType,
} from "@/modules/types"
import { filterTabsOf } from "./entries"

/** The resolved words and day formats the entries of the facts list are made of. */
export interface FactWords {
    readonly typeOf: (type: FactSubjectType) => string
    readonly scopeOf: (scope: FactScope) => string
    /** "Public: customers and every agent", with the names of the agents a restricted fact is limited to. */
    readonly scopeLineOf: (scope: FactScope, agents: string) => string
    readonly sourceOf: (source: FactSource) => string
    readonly onlyAgents: (agents: string) => string
    readonly proposalLine: string
    readonly validityNone: string
    readonly headLine: string
    readonly valueLabel: string
    readonly termType: string
    readonly termScope: string
    readonly termValidity: string
    readonly termSource: string
    readonly termAddedBy: string
    readonly addedBy: (who: string, date: string) => string
    readonly sinceOf: (date: string) => string
    readonly untilOf: (date: string) => string
    readonly betweenOf: (from: string, to: string) => string
    readonly scheduledOf: (date: string) => string
    readonly retireLabel: string
    readonly editLabel: string
    readonly historyTitle: string
    readonly historyNow: string
    readonly historyReplaced: string
    readonly historyExpired: string
    readonly historyScheduled: string
    /** A day with its year (`01/10/2026`) and without (`01/10`). */
    readonly day: (iso: string) => string
    readonly dayShort: (iso: string) => string
}

/** What the facts of the list are read against. */
export interface FactEntriesInput {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    /** The fact a stop is being sent for. */
    readonly pending: string | undefined
    readonly words: FactWords
    /** The workspace the links of the facts lead within. */
    readonly workspaceId: string
}

/** The tone of the chip of each scope: only the restricted one asks for a second look. */
const SCOPE_CHIP_TONE: Readonly<Record<FactScope, BrainChipView["tone"]>> = {
    public: "neutral",
    internal: "neutral",
    restricted: "warning",
}

/** The facts the list shows: the ones in force and the ones scheduled, as a value (not a proposal to stop). */
const shownFactsOf = (facts: ReadonlyArray<BrainFact>): ReadonlyArray<BrainFact> =>
    facts.filter((fact) => (fact.status === "active" || fact.status === "scheduled") && fact.proposalKind === "set")

/** The key two values of one fact share. */
const keyOf = (fact: BrainFact): string => [fact.subjectKey, fact.attribute, fact.installationId ?? ""].join("|")

const valueOf = (fact: BrainFact): string => (fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`)

const namesOf = (fact: BrainFact, lenses: ReadonlyArray<BrainLens>): string =>
    fact.modules.map((module) => lenses.find((lens) => lens.module === module)?.name ?? module).join(", ")

/** How long a value holds: since, until, between, or no limit (empty). */
const rangeOf = (words: FactWords, from: string | null, to: string | null, format: (iso: string) => string): string => {
    if (from !== null && to !== null) return words.betweenOf(format(from), format(to))
    if (from !== null) return words.sinceOf(format(from))
    return to === null ? "" : words.untilOf(format(to))
}

/** What matters most about a value after the value: a proposal waiting, who may see it, or how long it holds. */
const tailOf = (fact: BrainFact, input: FactEntriesInput, hasProposal: boolean): string => {
    const words = input.words
    if (hasProposal) return words.proposalLine
    if (fact.scope === "restricted" && fact.modules.length > 0) return words.onlyAgents(namesOf(fact, input.lenses))
    if (fact.status === "scheduled" && fact.validFrom !== null) return words.scheduledOf(words.dayShort(fact.validFrom))
    return rangeOf(words, fact.validTo === null ? fact.validFrom : null, fact.validTo, words.dayShort)
}

/** The moment a value began, for ordering its history. */
const beganOf = (fact: BrainFact): number => Date.parse(fact.validFrom ?? fact.proposedAt)

/** What a value of the history says about itself: its state, then when it held. */
const historyLineOf = (fact: BrainFact, stateWord: string, words: FactWords): string => {
    const isPast = fact.status === "superseded" || fact.status === "expired"
    const from = fact.validFrom ?? (isPast ? fact.proposedAt : null)
    const to = isPast ? (fact.validTo ?? fact.decidedAt) : null
    const rangeEnd = isPast ? null : to
    const range =
        isPast && from !== null && to !== null
            ? words.betweenOf(words.dayShort(from), words.dayShort(to))
            : rangeOf(words, from, rangeEnd, words.dayShort)
    return [stateWord, range].filter((part) => part !== "").join(" · ")
}

/** The values the same fact had or will have, the newest first, each with what became of it. */
const historyOf = (fact: BrainFact, input: FactEntriesInput): ReadonlyArray<FactHistoryView> => {
    const words = input.words
    const states: Readonly<Partial<Record<BrainFact["status"], string>>> = {
        active: words.historyNow,
        scheduled: words.historyScheduled,
        superseded: words.historyReplaced,
        expired: words.historyExpired,
    }
    return input.facts
        .filter((one) => keyOf(one) === keyOf(fact) && states[one.status] !== undefined && one.proposalKind === "set")
        .toSorted((left, right) => beganOf(right) - beganOf(left))
        .map((one) => ({ id: one.id, value: valueOf(one), line: historyLineOf(one, states[one.status] ?? "", words) }))
}

/** The terms of the opened fact: its type, who may see it, how long it holds, where it came from and who added it. */
const termsOf = (fact: BrainFact, input: FactEntriesInput): FactDetailView["terms"] => {
    const words = input.words
    const validity = rangeOf(words, fact.validFrom, fact.validTo, words.day)
    return [
        { id: "type", term: words.termType, text: words.typeOf(fact.subjectType) },
        { id: "scope", term: words.termScope, text: words.scopeLineOf(fact.scope, namesOf(fact, input.lenses)) },
        { id: "validity", term: words.termValidity, text: validity === "" ? words.validityNone : validity },
        {
            id: "source",
            term: words.termSource,
            text: fact.evidence[0]?.sourceTitle ?? words.sourceOf(fact.sourceKind),
        },
        {
            id: "addedBy",
            term: words.termAddedBy,
            text: words.addedBy(fact.proposedBy, words.dayShort(fact.proposedAt)),
        },
    ]
}

/** The opened fact: its value, its terms, its commands and its history. */
const detailOf = (fact: BrainFact, input: FactEntriesInput): FactDetailView => ({
    valueLabel: input.words.valueLabel,
    value: valueOf(fact),
    terms: termsOf(fact, input),
    retire: input.canWrite ? { label: input.words.retireLabel, isPending: input.pending === fact.id } : null,
    edit: input.canWrite
        ? {
              label: input.words.editLabel,
              href: workspaceHref(input.workspaceId, brainTabHref("facts", { edit: fact.id })),
          }
        : null,
    historyTitle: input.words.historyTitle,
    history: historyOf(fact, input),
})

/** The rows of the facts list, each with the detail that opens beside it. */
export const factEntriesOf = (input: FactEntriesInput): ReadonlyArray<FactEntryView> => {
    const proposed = new Set(
        input.facts.filter((fact) => fact.status === "proposed" && fact.proposalKind === "set").map(keyOf),
    )
    return shownFactsOf(input.facts).map((fact) => {
        const badge: BrainChipView = { label: input.words.scopeOf(fact.scope), tone: SCOPE_CHIP_TONE[fact.scope] }
        const title = `${fact.subjectLabel} · ${fact.attributeLabel}`
        const line = [valueOf(fact), tailOf(fact, input, proposed.has(keyOf(fact)))]
        return {
            id: fact.id,
            filter: fact.subjectType,
            title,
            line: line.filter((part) => part !== "").join(" · "),
            badge,
            head: { title, description: input.words.headLine, badge },
            detail: detailOf(fact, input),
        }
    })
}

/** The tabs of the facts list: all of them, then each subject type that has facts, in the order the form lists them. */
export const factFilterTabsOf = (
    entries: ReadonlyArray<FactEntryView>,
    all: string,
    typeOf: (type: FactSubjectType) => string,
): ReadonlyArray<BrainFilterView> =>
    filterTabsOf(
        entries,
        all,
        FACT_SUBJECT_TYPES.map((type) => ({ id: type, label: typeOf(type) })),
    )

/**
 * The rows of the facts list while the first read waits: the static words are the real ones, every value is empty, so the skeleton
 * keeps the geometry of the ready list and detail.
 */
export const factPlaceholderOf = (words: FactWords): ReadonlyArray<FactEntryView> =>
    ["a", "b", "c", "d", "e", "f"].map((id) => {
        const badge: BrainChipView = { label: "", tone: "neutral" }
        return {
            id,
            filter: "all",
            title: "",
            line: "",
            badge,
            head: { title: "", description: "", badge },
            detail: {
                valueLabel: words.valueLabel,
                value: "",
                terms: [
                    { id: "type", term: words.termType, text: "" },
                    { id: "scope", term: words.termScope, text: "" },
                    { id: "validity", term: words.termValidity, text: "" },
                    { id: "source", term: words.termSource, text: "" },
                    { id: "addedBy", term: words.termAddedBy, text: "" },
                ],
                retire: null,
                edit: null,
                historyTitle: words.historyTitle,
                history: [
                    { id: "now", value: "", line: "" },
                    { id: "before", value: "", line: "" },
                ],
            },
        }
    })
