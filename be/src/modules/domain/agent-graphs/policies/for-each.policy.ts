import { LOOP_BODY_ROUTE, LOOP_STEP } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { StepJson } from "@modules/domain/agent-runs"

/** One element of the list a loop works on, as a step input carries it. */
export type LoopValue = StepJson[string]

/** The loop a body step runs in: the for-each node, the iteration and the list (at most the node's `max`, so bounded). */
export interface LoopFrame {
    /** The for-each node. */
    readonly nodeKey: string
    /** The iteration, from 0. */
    readonly index: number
    /** The whole list, in order. */
    readonly items: ReadonlyArray<LoopValue>
}

/** How one iteration ended, as its join step carries it: the output of the last body node, or the business failure it ended in. */
export interface LoopJoin {
    /** The iteration. */
    readonly index: number
    /** The output of the last body node; null for a failed iteration. */
    readonly output: LoopValue
    /** The business failure the iteration ended in, or null. */
    readonly error: LoopError | null
}

/** A business failure an iteration ended in, as the loop's output lists it. */
export interface LoopError {
    /** The stable code. */
    readonly code: string
    /** The words, in the run's language. */
    readonly message: string
}

/** One iteration in the loop's output. */
export interface LoopResult {
    /** The iteration. */
    readonly index: number
    /** The element it worked on. */
    readonly item: LoopValue
    /** The output of its last body node. */
    readonly output: LoopValue
}

/** One failed iteration in the loop's output. */
export interface LoopFailure {
    /** The iteration. */
    readonly index: number
    /** The element it worked on. */
    readonly item: LoopValue
    /** The business failure it ended in. */
    readonly error: LoopError
}

/** The output of a for-each step once every iteration ran. */
export interface LoopSummary {
    /** The iterations that ended well, in order. */
    readonly results: ReadonlyArray<LoopResult>
    /** How many ended well. */
    readonly okCount: number
    /** The iterations that ended in a business failure, in order. */
    readonly failed: ReadonlyArray<LoopFailure>
}

/** The mark of the step that closes one iteration of a loop: `<loop node>#<index>`. */
const JOIN_MARK = "#"

/** Whether a node is a for-each step. */
export const isLoop = (node: GraphSpecNode): boolean => node.step === LOOP_STEP

/** The first node of a loop's body, or undefined when the loop has none. */
export const bodyOf = (flow: GraphSpec, loop: GraphSpecNode): GraphSpecNode | undefined => {
    const key = loop.routes?.[LOOP_BODY_ROUTE]
    return key === undefined ? undefined : flow.nodes.find((candidate) => candidate.key === key)
}

/** The step key of a node of a loop body in one iteration (`<node>[<index>]`, the key lead memory keeps it under too). */
export { iterationKeyOf } from "@nivo-lite/agent-sdk/node"

/** The step key of the join of one iteration. */
export const joinKeyOf = (loopKey: string, index: number): string => `${loopKey}${JOIN_MARK}${index}`

/** The node key a step of a loop ran: the step key without its iteration or join mark. */
export const loopNodeKeyOf = (stepKey: string): string => stepKey.replace(/\[\d+\]$/, "").replace(/#\d+$/, "")

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The join a done step of a loop recorded, or null for any other step. */
const joinedOf = (result: StepJson | undefined): LoopJoin | null => {
    const joined = result?.joined
    if (!isRecord(joined) || typeof joined.index !== "number") return null
    const error =
        isRecord(joined.error) && typeof joined.error.code === "string"
            ? { code: joined.error.code, message: typeof joined.error.message === "string" ? joined.error.message : "" }
            : null
    return { index: joined.index, output: joined.output ?? null, error }
}

/** The joins of a loop done before this step, by iteration, read from the results of the run's done steps. */
export const joinsOf = (loopKey: string, earlier: Readonly<Record<string, StepJson>>): ReadonlyArray<LoopJoin> =>
    Object.entries(earlier)
        .filter(([key]) => key.startsWith(`${loopKey}${JOIN_MARK}`))
        .flatMap(([, result]) => joinedOf(result) ?? [])

/** The output of a loop once its last iteration joined: each iteration in order, the failed ones apart. */
export const summaryOf = (items: ReadonlyArray<LoopValue>, joins: ReadonlyArray<LoopJoin>): LoopSummary => {
    const byIndex = new Map(joins.map((join) => [join.index, join]))
    const results: Array<LoopResult> = []
    const failed: Array<LoopFailure> = []
    items.forEach((item, index) => {
        const join = byIndex.get(index)
        if (join?.error != null) failed.push({ index, item, error: join.error })
        else results.push({ index, item, output: join?.output ?? null })
    })
    return { results, okCount: results.length, failed }
}

/** The summary as the plain data a step result keeps. */
export const summaryJsonOf = (summary: LoopSummary): StepJson => ({
    results: summary.results.map((result) => ({ index: result.index, item: result.item, output: result.output })),
    okCount: summary.okCount,
    failed: summary.failed.map((each) => ({ index: each.index, item: each.item, error: { ...each.error } })),
})

/** A join as the plain data a step result keeps. */
export const joinJsonOf = (join: LoopJoin): StepJson => ({
    index: join.index,
    output: join.output,
    error: join.error === null ? null : { ...join.error },
})
