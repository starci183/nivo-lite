import { factKeysOf, type FactKey } from "@/modules/brain"
import type { BrainFact } from "@/modules/types"

/** How many facts one page of the list asks the server for. */
export const FACTS_PAGE_SIZE = 50

/** The states the facts page is narrowed to. */
export const FACT_STATUS_FILTERS = ["all", "waiting", "active", "conflict", "retired"] as const

/** One state the facts page is narrowed to. */
export type FactStatusFilter = (typeof FACT_STATUS_FILTERS)[number]

/** The kind of key each state keeps; "all" keeps every key still in use or waiting. */
const KIND_OF: Readonly<Record<Exclude<FactStatusFilter, "all">, FactKey["kind"]>> = {
    waiting: "fresh",
    active: "settled",
    conflict: "conflict",
    retired: "retired",
}

/**
 * The states the server is asked for by tab (BRAIN-PAGING item 1); "conflict" is a reading of both a value in force and a proposal, so
 * that tab is drawn from the whole read of the brain and never pages.
 */
const SERVER_STATUSES: Readonly<Record<Exclude<FactStatusFilter, "conflict">, ReadonlyArray<string> | undefined>> = {
    all: undefined,
    waiting: ["proposed"],
    active: ["active", "scheduled"],
    retired: ["expired"],
}

/** The server states a tab asks for; undefined for the default set and for the tab that is not read page by page. */
export const serverStatusesOf = (filter: FactStatusFilter): ReadonlyArray<string> | undefined =>
    filter === "conflict" ? undefined : SERVER_STATUSES[filter]

/** Whether a key falls under a state. */
export const isIn = (one: FactKey, filter: FactStatusFilter): boolean =>
    filter === "all" ? one.kind !== "retired" : one.kind === KIND_OF[filter]

/** The words of a key the search reads: what it is about and its values. */
const wordsOfKey = (one: FactKey): string =>
    [one.lead.subjectLabel, one.lead.attributeLabel, ...one.options.map((fact) => fact.value), one.lead.value]
        .join(" ")
        .toLowerCase()

/** What the rows of the list are read from. */
interface ShownInput {
    readonly filter: FactStatusFilter
    /** The words typed, as typed. */
    readonly query: string
    /** Every key of the whole read of the brain. */
    readonly keys: ReadonlyArray<FactKey>
    /** The facts of the page the server answered; undefined until it answers. */
    readonly page: ReadonlyArray<BrainFact> | undefined
}

/**
 * The keys the list draws. A tab the server pages draws the keys of the page it answered (each key as the whole read of the brain
 * knows it, so a value in force beside a proposal is still a conflict); the conflict tab is filtered and searched here.
 */
export const shownKeysOf = (input: ShownInput): ReadonlyArray<FactKey> => {
    if (input.filter !== "conflict") {
        const whole = new Map(input.keys.map((one) => [one.key, one]))
        const answered = input.page === undefined ? [] : factKeysOf(input.page)
        return answered.map((one) => whole.get(one.key) ?? one)
    }
    const needle = input.query.trim().toLowerCase()
    return input.keys.filter((one) => isIn(one, "conflict") && (needle === "" || wordsOfKey(one).includes(needle)))
}
