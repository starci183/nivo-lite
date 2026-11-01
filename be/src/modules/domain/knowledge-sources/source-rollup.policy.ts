import type { SourceSummary } from "./knowledge-sources.contracts"
import { firstPartIdOf, wholeTitleOf } from "./source-parts.policy"

/** A listed source with the origin that tells whether it is a later part of a long document. */
export interface ListedSource {
    /** The source as the page lists it. */
    readonly summary: SourceSummary
    /** Where it came from: `part:<id of the first part>` for a later part. */
    readonly origin: string | null
}

/** How much a status needs the owner's eye, the greatest first: a failed part makes the document failed, a part still being read makes it busy. */
const WEIGHT: Readonly<Record<string, number>> = { failed: 5, blocked_credits: 4, ready: 0 }

/** The weight of a status; every status of a worker still on the source weighs the same, between a block and ready. */
const weightOf = (status: string): number => WEIGHT[status] ?? 3

/** The source of the parts that stands for the document in the list: the one that most needs attention, the first part when they tie. */
const leadOf = (first: SourceSummary, later: ReadonlyArray<SourceSummary>): SourceSummary =>
    later.reduce((lead, one) => (weightOf(one.status) > weightOf(lead.status) ? one : lead), first)

/** One document of the list with all its parts: the totals are summed, the state is the state of the part that most needs attention. */
const mergedOf = (first: SourceSummary, later: ReadonlyArray<SourceSummary>): SourceSummary => {
    const all = [first, ...later]
    const lead = leadOf(first, later)
    return {
        ...first,
        title: wholeTitleOf(first.title),
        status: lead.status,
        error: lead.error ?? all.find((one) => one.error !== null)?.error ?? null,
        progress: lead.progress,
        stage: lead.stage,
        stageDone: lead.stageDone,
        stageTotal: lead.stageTotal,
        chunkCount: all.reduce((sum, one) => sum + one.chunkCount, 0),
        sizeBytes: all.reduce((sum, one) => sum + one.sizeBytes, 0),
        updatedAt: all.reduce((newest, one) => (one.updatedAt > newest ? one.updatedAt : newest), first.updatedAt),
        partCount: all.length,
    }
}

/**
 * The listing as the owner reads it: a document cut into parts is one row, the first part, standing for all of them. A later part whose
 * first part is not in the listing stays a row of its own, so nothing disappears from the page.
 */
export const withPartsRolledUp = (listed: ReadonlyArray<ListedSource>): ReadonlyArray<SourceSummary> => {
    const firsts = new Set(listed.map((one) => one.summary.id))
    const laterOf = (id: string): ReadonlyArray<SourceSummary> =>
        listed.filter((one) => firstPartIdOf(one.origin) === id).map((one) => one.summary)
    return listed
        .filter((one) => {
            const first = firstPartIdOf(one.origin)
            return first === null || !firsts.has(first)
        })
        .map((one) => {
            const later = laterOf(one.summary.id)
            return later.length === 0 ? one.summary : mergedOf(one.summary, later)
        })
}
