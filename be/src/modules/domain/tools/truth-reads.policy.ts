import type { ToolJson } from "./tools.contracts"

/** One truth a read served: the fact and the version of it the agent read (null when the store never numbered it). */
export interface TruthRead {
    /** The fact. */
    readonly factId: string
    /** Its version when it was read, or null. */
    readonly version: number | null
}

/** The most truths one audit line keeps (a list answers at most this many; the rest of a longer answer is not kept). */
export const TRUTH_READS_MAX = 50

/** A value as a record of members, or null for anything that is not a plain object. */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null

/** A served truth's `{ id, v }`, or null for anything else. */
const readOf = (value: unknown): TruthRead | null => {
    const line = recordOf(value)
    const id = line?.id
    const version = line?.v
    if (typeof id !== "string" || id === "") return null
    return { factId: id, version: typeof version === "number" && Number.isInteger(version) ? version : null }
}

/** The members of an answer that are lists, or nothing. */
const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

/**
 * The truths a truth-graph read served, in the order it answered them, each once: the facts of a search or a list (`facts`), the one
 * fact of a get or of a relation read (`fact`), and the truths a relation read joins (`related[].fact`). Ids and versions only: never
 * the value, the source or a passage (the audit summary keeps the masked rest).
 */
export const truthReadsOf = (answer: ToolJson): ReadonlyArray<TruthRead> => {
    const record = recordOf(answer)
    if (record === null) return []
    const served: ReadonlyArray<unknown> = [
        ...listOf(record.facts),
        record.fact,
        ...listOf(record.related).map((line) => recordOf(line)?.fact),
    ]
    const reads = new Map<string, TruthRead>()
    for (const one of served) {
        const read = readOf(one)
        if (read !== null && !reads.has(read.factId)) reads.set(read.factId, read)
    }
    return [...reads.values()].slice(0, TRUTH_READS_MAX)
}
