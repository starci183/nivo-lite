import type { BrainFact } from "@/modules/types"
import { sameValue } from "./keys"

/** One proposal with the active value it would replace. */
export interface ReviewSingle {
    readonly p: BrainFact
    readonly current: BrainFact | null
}

/** Several waiting values for one subject and attribute. */
export interface ReviewConflict {
    readonly key: string
    readonly subjectLabel: string
    readonly attributeLabel: string
    readonly current: BrainFact | null
    /** The competing values (distinct), newest proposal first. */
    readonly options: ReadonlyArray<BrainFact>
    /** A waiting proposal to stop using the current value, if any. */
    readonly retire: BrainFact | null
}

/** What waits for the owner, grouped by key. */
export interface ReviewBoard {
    readonly groups: ReadonlyArray<ReviewConflict>
    readonly singles: ReadonlyArray<ReviewSingle>
    readonly retires: ReadonlyArray<ReviewSingle>
    /** Cards in the list: groups, singles and retires. */
    readonly cards: number
    /** Cards that are a conflict: every group, plus singles that differ from the active value. */
    readonly conflicts: number
}

const factKey = (fact: Pick<BrainFact, "subjectKey" | "attribute">): string => `${fact.subjectKey}|${fact.attribute}`

/**
 * What waits for the owner's review, grouped by key (subject and attribute). Proposals of one key that carry different values are a
 * conflict and show as one card with the competing values side by side; a single proposal that differs from the active value is a
 * conflict too; a "stop using" proposal is its own row unless the key also has competing values.
 */
export const reviewBoardOf = (facts: ReadonlyArray<BrainFact>): ReviewBoard => {
    const active = new Map<string, BrainFact>()
    const sets = new Map<string, Array<BrainFact>>()
    const retiring = new Map<string, BrainFact>()
    for (const fact of facts) {
        if (fact.status === "active") active.set(factKey(fact), fact)
        else if (fact.status === "proposed" && fact.proposalKind === "retire") retiring.set(factKey(fact), fact)
        else if (fact.status === "proposed") sets.set(factKey(fact), [...(sets.get(factKey(fact)) ?? []), fact])
    }
    const newestFirst = (a: BrainFact, b: BrainFact) => b.proposedAt.localeCompare(a.proposedAt)
    const groups: Array<ReviewConflict> = []
    const singles: Array<ReviewSingle> = []
    for (const [key, list] of sets) {
        const options = [...list]
            .sort(newestFirst)
            .filter((option, index, all) => all.findIndex((other) => sameValue(other.value, option.value)) === index)
        const current = active.get(key) ?? null
        const retire = retiring.get(key) ?? null
        const first = options[0]
        if (first !== undefined && (options.length >= 2 || retire !== null)) {
            groups.push({
                key,
                subjectLabel: first.subjectLabel,
                attributeLabel: first.attributeLabel,
                current,
                options,
                retire,
            })
        } else {
            for (const p of list) singles.push({ p, current })
        }
    }
    const retires = [...retiring.entries()]
        .filter(([key]) => !sets.has(key))
        .map(([key, p]): ReviewSingle => ({ p, current: active.get(key) ?? null }))
    singles.sort(
        (a, b) =>
            Number(b.current !== null) - Number(a.current !== null) || b.p.proposedAt.localeCompare(a.p.proposedAt),
    )
    return {
        groups,
        singles,
        retires,
        cards: groups.length + singles.length + retires.length,
        conflicts: groups.length + singles.filter((single) => single.current !== null).length,
    }
}
