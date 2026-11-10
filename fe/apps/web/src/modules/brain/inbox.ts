import type { BrainFact } from "@/modules/types"
import { sameValue } from "./keys"

/** Where one subject and attribute of the brain stands: nothing waits, one value waits, the owner has to choose, or it is no longer used. */
export type FactKeyKind = "settled" | "fresh" | "conflict" | "retired"

/**
 * One subject and attribute of the brain with every value it has: the value in force (or the one scheduled), the proposals that set a
 * value (newest first), the distinct values among them (two values that say the same thing are one), and a proposal to stop using it.
 */
export interface FactKey {
    readonly key: string
    readonly kind: FactKeyKind
    readonly current: BrainFact | null
    readonly proposals: ReadonlyArray<BrainFact>
    readonly options: ReadonlyArray<BrainFact>
    readonly retire: BrainFact | null
    /** The fact that stands for the key in a list: the one proposal of a fresh key, the first option of a conflict, else the value in force. */
    readonly lead: BrainFact
}

/** Two values of one key that say the same thing in other words: they were merged into one row. */
export interface MergedPair {
    readonly kept: string
    readonly merged: string
}

/** The key facts are grouped on: the subject and the attribute, as the back end counts the cards. */
export const factKeyOf = (fact: Pick<BrainFact, "subjectKey" | "attribute">): string =>
    `${fact.subjectKey}|${fact.attribute}`

const newestFirst = (a: BrainFact, b: BrainFact): number => b.proposedAt.localeCompare(a.proposedAt)

/** The values of a list, two values that say the same thing counting once, newest first. */
const distinctOf = (proposals: ReadonlyArray<BrainFact>): ReadonlyArray<BrainFact> =>
    proposals.filter((option, index, all) => all.findIndex((other) => sameValue(other.value, option.value)) === index)

/** Whether the owner has to choose: two different values, a stop beside a value, or one value that differs from the value in force. */
const isConflict = (
    options: ReadonlyArray<BrainFact>,
    current: BrainFact | null,
    retire: BrainFact | null,
): boolean => {
    const first = options[0]
    if (options.length >= 2 || (retire !== null && current !== null)) return true
    return first !== undefined && current !== null && !sameValue(current.value, first.value)
}

/** What one key holds, read from its facts. */
interface KeyBucket {
    readonly active: Array<BrainFact>
    readonly scheduled: Array<BrainFact>
    readonly sets: Array<BrainFact>
    readonly retires: Array<BrainFact>
    readonly expired: Array<BrainFact>
}

const bucketsOf = (facts: ReadonlyArray<BrainFact>): ReadonlyMap<string, KeyBucket> => {
    const buckets = new Map<string, KeyBucket>()
    for (const fact of facts) {
        const key = factKeyOf(fact)
        const bucket = buckets.get(key) ?? { active: [], scheduled: [], sets: [], retires: [], expired: [] }
        buckets.set(key, bucket)
        if (fact.status === "active" && fact.proposalKind === "set") bucket.active.push(fact)
        else if (fact.status === "scheduled" && fact.proposalKind === "set") bucket.scheduled.push(fact)
        else if (fact.status === "proposed" && fact.proposalKind === "retire") bucket.retires.push(fact)
        else if (fact.status === "proposed") bucket.sets.push(fact)
        else if (fact.status === "expired" && fact.proposalKind === "set") bucket.expired.push(fact)
    }
    return buckets
}

/** The key one bucket makes: a key that only had values which expired is no longer used; null when it holds nothing to show. */
const keyOfBucket = (key: string, bucket: KeyBucket): FactKey | null => {
    const proposals = [...bucket.sets].sort(newestFirst)
    const options = distinctOf(proposals)
    const current = bucket.active[0] ?? bucket.scheduled[0] ?? null
    const retire = bucket.retires[0] ?? null
    const lead = options[0] ?? current ?? retire
    const gone = [...bucket.expired].sort(newestFirst)[0]
    if (lead === null)
        return gone === undefined
            ? null
            : { key, kind: "retired", current: null, proposals, options, retire, lead: gone }
    const waits = proposals.length > 0 || retire !== null
    let kind: FactKeyKind = "settled"
    if (waits) kind = isConflict(options, current, retire) ? "conflict" : "fresh"
    return { key, kind, current, proposals, options, retire, lead }
}

/**
 * Every subject and attribute of the brain that has a value in force, a value scheduled, a proposal waiting or only values that expired:
 * one entry per key, the way the back end counts the cards, so the inbox, the facts page and the rail read the same number.
 */
export const factKeysOf = (facts: ReadonlyArray<BrainFact>): ReadonlyArray<FactKey> =>
    [...bucketsOf(facts).entries()].flatMap(([key, bucket]) => {
        const one = keyOfBucket(key, bucket)
        return one === null ? [] : [one]
    })

/** How many rows the facts page lists under "all": one per key still in use or waiting. */
export const factRowCountOf = (facts: ReadonlyArray<BrainFact>): number =>
    factKeysOf(facts).filter((one) => one.kind !== "retired").length

/** The values that said the same thing as a kept value and were merged into its row, worded differently. */
export const mergedPairsOf = (keys: ReadonlyArray<FactKey>): ReadonlyArray<MergedPair> =>
    keys.flatMap((one) =>
        one.proposals.flatMap((fact) => {
            const kept = one.options.find((option) => sameValue(option.value, fact.value))
            return kept === undefined || kept.id === fact.id || kept.value === fact.value
                ? []
                : [{ kept: kept.value, merged: fact.value }]
        }),
    )

/** The documents a fact cites: their ids and titles, in the order the evidence lists them. */
export const documentsOfFact = (fact: BrainFact): ReadonlyArray<{ readonly id: string; readonly title: string }> =>
    fact.evidence.flatMap((proof) =>
        proof.kind === "document" ? [{ id: proof.ref, title: proof.sourceTitle ?? proof.label }] : [],
    )

/** The documents the values of a key cite, each once. */
export const keyDocumentsOf = (one: FactKey): ReadonlyArray<string> => [
    ...new Set(
        [...one.options, ...(one.retire === null ? [] : [one.retire])].flatMap((fact) =>
            documentsOfFact(fact).map((doc) => doc.id),
        ),
    ),
]
