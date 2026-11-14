import type { AgentRunQuery, BrainQuery } from "@/modules/api"

/** One read of the truths as the back end answers it: the tool, the moment and the facts (ids and versions) it handed the agent. */
export type TruthReadWire = NonNullable<AgentRunQuery["agentRun"]>["truthReads"][number]

/** One fact of the shop's brain as the brain read answers it. */
export type ReadFactWire = BrainQuery["brain"]["facts"][number]

/** One row of the "read in this run" card: one truth, however often the run read it. */
export interface ReadRowView {
    readonly id: string
    readonly title: string
    /** The 12 muted line: "Truth · version 7 · set by the owner", with how often it was read when more than once. */
    readonly subtitle: string
    /** The value the shop holds now, or "" when the truth is no longer in force or waiting. */
    readonly value: string
    /** The truth is no longer the one the run read: the row is muted and has no value. */
    readonly isGone: boolean
}

/** The words of a row. */
export interface ReadWords {
    readonly title: (subject: string, attribute: string) => string
    readonly subtitle: (version: number | null, source: string, count: number) => string
    readonly source: (kind: string) => string
    readonly gone: (version: number | null) => string
    readonly goneSubtitle: (count: number) => string
}

/** What one fact was read as, over all the reads of the run. */
interface Tally {
    readonly factId: string
    count: number
    version: number | null
}

/** The facts the run read, in the order of their first read, with how often each was read and the last version seen. */
const talliesOf = (reads: ReadonlyArray<TruthReadWire>): ReadonlyArray<Tally> => {
    const byId = new Map<string, Tally>()
    for (const read of reads)
        for (const fact of read.facts) {
            const known = byId.get(fact.factId)
            if (known === undefined) byId.set(fact.factId, { factId: fact.factId, count: 1, version: fact.version ?? null })
            else {
                known.count += 1
                known.version = fact.version ?? known.version
            }
        }
    return [...byId.values()]
}

/** The rows of the card: one per truth read, named and valued from the brain's facts; a truth no longer there says so and holds no value. */
export const readRowsOf = (
    reads: ReadonlyArray<TruthReadWire>,
    facts: ReadonlyArray<ReadFactWire>,
    words: ReadWords,
): ReadonlyArray<ReadRowView> => {
    const byId = new Map(facts.map((fact) => [fact.id, fact]))
    return talliesOf(reads).map((tally): ReadRowView => {
        const fact = byId.get(tally.factId)
        if (fact === undefined)
            return {
                id: tally.factId,
                title: words.gone(tally.version),
                subtitle: words.goneSubtitle(tally.count),
                value: "",
                isGone: true,
            }
        const sameWords = fact.subjectLabel === fact.attributeLabel || fact.attributeLabel === ""
        const unit = fact.unit === null || fact.unit === "" ? "" : ` ${fact.unit}`
        return {
            id: tally.factId,
            title: sameWords ? fact.subjectLabel : words.title(fact.subjectLabel, fact.attributeLabel),
            subtitle: words.subtitle(tally.version, words.source(fact.sourceKind), tally.count),
            value: `${fact.value}${unit}`,
            isGone: false,
        }
    })
}
