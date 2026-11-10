import type {
    BrainFact,
    BrainLens,
    ConflictDrawerView,
    ConflictOptionView,
    FactDrawerDetailView,
    FactSource,
    FactSubjectType,
    PickBadgeView,
} from "@/modules/types"
import { trustBadgeOf, valueOf } from "./fact-pick"
import type { FactPickWords } from "./fact-pick"
import { documentsOfFact, factKeyOf } from "./inbox"
import type { FactKey } from "./inbox"

/** The id of the choice that keeps the value in force. */
export const KEEP_CHOICE = "keep"

/** The id of the choice that stops using the value in force. */
export const RETIRE_CHOICE = "retire"

/** The resolved words of the two drawers. */
export interface FactDrawerWords {
    readonly pick: FactPickWords
    readonly close: string
    readonly typeOf: (type: FactSubjectType) => string
    readonly sourceOf: (source: FactSource) => string
    readonly audienceOf: (audience: BrainLens["audience"]) => string
    readonly day: (iso: string) => string
    readonly conflictLine: (documents: number, values: number) => string
    readonly todayTitle: string
    readonly todayLabel: string
    readonly todayInUse: string
    readonly todayNone: string
    readonly todayNoteInUse: (source: string) => string
    readonly todayNoteNone: string
    readonly chooseTitle: (values: number) => string
    readonly keepOption: string
    readonly retireOption: string
    readonly documentsBadge: (count: number) => string
    readonly conditionFrom: (date: string) => string
    readonly conditionUntil: (date: string) => string
    readonly readersTitle: string
    readonly readersEmpty: string
    readonly footerNote: string
    readonly later: string
    readonly chooseNone: string
    readonly useValue: (value: string) => string
    readonly keepValue: (value: string) => string
    readonly stopUsing: string
    readonly valueLabel: string
    readonly quoteTitle: string
    readonly statusWaiting: string
    readonly statusActive: string
    readonly statusScheduled: string
    readonly termType: string
    readonly termReaders: string
    readonly termSource: string
    readonly termAddedBy: (who: string, date: string) => string
    readonly termAddedByLabel: string
    readonly historyTitle: string
    readonly historyState: (status: BrainFact["status"]) => string
    readonly approve: string
    readonly reject: string
    readonly edit: string
    readonly menuLabel: string
    readonly showHistory: string
    readonly retire: string
}

/** The agents that read a fact: every agent for a public fact, the internal ones for an internal fact, the named ones for a restricted fact. */
export const readersOf = (fact: BrainFact, lenses: ReadonlyArray<BrainLens>): ReadonlyArray<BrainLens> => {
    if (fact.scope === "public") return lenses
    if (fact.scope === "internal") return lenses.filter((lens) => lens.audience === "internal")
    return lenses.filter((lens) => fact.modules.includes(lens.module))
}

/** When a value holds, as its condition; null when it always holds. */
const conditionOf = (fact: BrainFact, words: FactDrawerWords): string | null => {
    if (fact.validFrom !== null) return words.conditionFrom(words.day(fact.validFrom))
    return fact.validTo === null ? null : words.conditionUntil(words.day(fact.validTo))
}

/** The documents behind a fact by name, or who said it when no document did. */
const sourcesOf = (fact: BrainFact, words: FactDrawerWords): ReadonlyArray<string> => {
    const titles = [...new Set(documentsOfFact(fact).map((doc) => doc.title))]
    return titles.length === 0 ? [words.sourceOf(fact.sourceKind)] : titles
}

/** The first words a fact was quoted in. */
const quoteOf = (fact: BrainFact): string | null =>
    fact.evidence.find((proof) => proof.quote !== undefined)?.quote ?? null

/** One value the owner can choose: a proposal of the key. */
const optionOf = (fact: BrainFact, words: FactDrawerWords): ConflictOptionView => {
    const documents = documentsOfFact(fact).length
    return {
        id: fact.id,
        value: valueOf(fact),
        quote: quoteOf(fact),
        sources: sourcesOf(fact, words),
        badges: [
            trustBadgeOf(fact, words.pick),
            ...(documents > 1 ? [{ label: words.documentsBadge(documents), tone: "muted" as const }] : []),
        ],
        condition: conditionOf(fact, words),
    }
}

/** The choices of a key: keep the value in force, each value proposed, stop using the value. */
const optionsOf = (one: FactKey, words: FactDrawerWords): ReadonlyArray<ConflictOptionView> => [
    ...(one.current === null
        ? []
        : [
              {
                  ...optionOf(one.current, words),
                  id: KEEP_CHOICE,
                  badges: [{ label: words.keepOption, tone: "success" as const }],
              },
          ]),
    ...one.options.map((fact) => optionOf(fact, words)),
    ...(one.retire === null || one.current === null
        ? []
        : [
              {
                  id: RETIRE_CHOICE,
                  value: words.retireOption,
                  quote: null,
                  sources: sourcesOf(one.retire, words),
                  badges: [],
                  condition: null,
              },
          ]),
]

/** The words of the choose command for the chosen option. */
const chooseLabelOf = (one: FactKey, chosenId: string | null, words: FactDrawerWords): string => {
    if (chosenId === KEEP_CHOICE && one.current !== null) return words.keepValue(valueOf(one.current))
    if (chosenId === RETIRE_CHOICE) return words.stopUsing
    const fact = one.options.find((option) => option.id === chosenId)
    return fact === undefined ? words.chooseNone : words.useValue(valueOf(fact))
}

/** What the comparison of a key draws: what the agent answers today, each value with its proof, who reads it, and the choice. */
export interface ConflictInput {
    readonly one: FactKey
    readonly lenses: ReadonlyArray<BrainLens>
    readonly chosenId: string | null
    readonly isPending: boolean
    readonly canWrite: boolean
    readonly words: FactDrawerWords
}

/** The comparison drawer of one key. */
export const conflictDrawerOf = (input: ConflictInput): ConflictDrawerView => {
    const { one, words } = input
    const current = one.current
    const today: PickBadgeView =
        current === null ? { label: words.todayNone, tone: "warning" } : { label: words.todayInUse, tone: "success" }
    const documents = new Set(
        [...one.options, ...(current === null ? [] : [current])].flatMap((fact) =>
            documentsOfFact(fact).map((doc) => doc.id),
        ),
    )
    return {
        title: `${one.lead.subjectLabel} · ${one.lead.attributeLabel}`,
        description: words.conflictLine(documents.size, one.options.length),
        closeLabel: words.close,
        todayTitle: words.todayTitle,
        today: {
            label: words.todayLabel,
            value: current === null ? null : valueOf(current),
            badge: today,
            note: current === null ? words.todayNoteNone : words.todayNoteInUse(sourcesOf(current, words).join(", ")),
        },
        chooseTitle: words.chooseTitle(one.options.length),
        options: optionsOf(one, words),
        chosenId: input.chosenId,
        readersTitle: words.readersTitle,
        readers: readersOf(one.lead, input.lenses).map((lens) => ({
            id: lens.module,
            name: lens.name,
            line: words.audienceOf(lens.audience),
        })),
        readersEmpty: words.readersEmpty,
        footerNote: words.footerNote,
        laterLabel: words.later,
        chooseLabel: chooseLabelOf(one, input.chosenId, words),
        isPending: input.isPending,
        canWrite: input.canWrite,
    }
}

/** The badge of where a fact stands. */
const statusOf = (fact: BrainFact, words: FactDrawerWords): PickBadgeView => {
    if (fact.status === "proposed") return { label: words.statusWaiting, tone: "warning" }
    return fact.status === "scheduled"
        ? { label: words.statusScheduled, tone: "accent" }
        : { label: words.statusActive, tone: "success" }
}

/** The values the key had, newest first, each with what became of it. */
const historyOf = (
    fact: BrainFact,
    facts: ReadonlyArray<BrainFact>,
    words: FactDrawerWords,
): FactDrawerDetailView["history"] =>
    facts
        .filter((one) => factKeyOf(one) === factKeyOf(fact) && one.proposalKind === "set" && one.status !== "proposed")
        .toSorted((left, right) =>
            (right.decidedAt ?? right.proposedAt).localeCompare(left.decidedAt ?? left.proposedAt),
        )
        .map((one) => ({
            id: one.id,
            value: valueOf(one),
            line: `${words.historyState(one.status)} · ${words.day(one.decidedAt ?? one.proposedAt)}`,
        }))

/** What the detail drawer of one fact is read against. */
export interface FactDetailInput {
    readonly fact: BrainFact
    readonly facts: ReadonlyArray<BrainFact>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    /** The command being sent for the fact: approve, reject or retire. */
    readonly pending: string | null
    readonly isHistoryOpen: boolean
    readonly retire: FactDrawerDetailView["retire"]
    readonly words: FactDrawerWords
}

/** The detail drawer of one fact: Approve is the primary with Edit value beside it; stopping the value sits last in the menu. */
export const factDrawerOf = (input: FactDetailInput): FactDrawerDetailView => {
    const { fact, words } = input
    const isWaiting = fact.status === "proposed" && fact.proposalKind === "set"
    const quote = quoteOf(fact)
    const readers = readersOf(fact, input.lenses).map((lens) => lens.name)
    const decides = input.canWrite && isWaiting
    return {
        title: `${fact.subjectLabel} · ${fact.attributeLabel}`,
        description: words.typeOf(fact.subjectType),
        closeLabel: words.close,
        valueLabel: words.valueLabel,
        value: valueOf(fact),
        badges: [statusOf(fact, words), trustBadgeOf(fact, words.pick)],
        quoteTitle: words.quoteTitle,
        quote: quote === null ? null : { text: quote, source: sourcesOf(fact, words).join(", ") },
        terms: [
            { id: "type", term: words.termType, text: words.typeOf(fact.subjectType) },
            {
                id: "readers",
                term: words.termReaders,
                text: readers.length === 0 ? words.readersEmpty : readers.join(", "),
            },
            { id: "source", term: words.termSource, text: sourcesOf(fact, words).join(", ") },
            {
                id: "addedBy",
                term: words.termAddedByLabel,
                text: words.termAddedBy(fact.proposedBy, words.day(fact.proposedAt)),
            },
        ],
        historyTitle: words.historyTitle,
        history: input.isHistoryOpen ? historyOf(fact, input.facts, words) : null,
        approve: decides ? { label: words.approve, isPending: input.pending === "approve" } : null,
        reject: decides ? { label: words.reject, isPending: input.pending === "reject" } : null,
        edit: input.canWrite && fact.proposalKind === "set" ? { label: words.edit } : null,
        menu: {
            label: words.menuLabel,
            entries: [
                { id: "history", label: words.showHistory, tone: "neutral" },
                ...(input.canWrite && fact.status === "active"
                    ? [{ id: "retire", label: words.retire, tone: "danger" as const }]
                    : []),
            ],
        },
        retire: input.retire,
    }
}
