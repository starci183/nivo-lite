import { loopBodiesOf, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { LOOP_BODY_ROUTE, LOOP_STEP, iterationKeyOf } from "@nivo-lite/agent-sdk/node"
import type { GraphNodeStepInput } from "@modules/domain/agent-graphs"
import type { StepJson } from "@modules/domain/agent-runs"

/**
 * A for-each on a thread is a SEQUENTIAL CYCLE: the loop node goes to the first node of its body, every way out of the body (a node with
 * nothing after it, a branch with no route, a `stop`) goes back to the loop node, and the loop node, visited again, joins the iteration
 * that just ended and sends the thread into the next one, or, after the last, writes the summary as its output and follows its own exit.
 * One iteration runs at a time; the frame (`state.loop`) says which, so a thread that is driven again after a crash goes on in the
 * iteration it was in and never runs a joined one again. This file is the pure part: the shape the compiler draws and the moves the
 * node function makes. Nested loops are refused (a thread holds one frame).
 */

/** The value of one element of a loop's list, as a step input carries it. */
export type LoopItem = StepJson[string]

/** The loops of one version: each for-each node with its body, and the loop each body node belongs to. */
export interface LoopShapes {
    /** The members of each loop's body, by the loop node's key. */
    readonly bodies: ReadonlyMap<string, ReadonlySet<string>>
    /** The loop node each body node belongs to, by node key. */
    readonly loopOf: ReadonlyMap<string, string>
}

/** Why a version's loops cannot run on a thread. */
export type LoopProblemCode = "TEMPLATE_LOOP_NESTED" | "TEMPLATE_LOOP_SHARED"

/** One problem of a loop and the node it is at. */
export interface LoopProblem {
    /** The reason. */
    readonly code: LoopProblemCode
    /** The node key. */
    readonly at: string
}

/** Whether a node is a for-each. */
export const isLoopNode = (node: GraphSpecNode): boolean => node.step === LOOP_STEP

/** The loops of a version: every for-each node with the nodes reachable from its `body` route without passing through it again. */
export const loopShapesOf = (spec: GraphSpec): LoopShapes => {
    const loops = spec.nodes.filter((node) => isLoopNode(node)).map((node) => node.key)
    const found = loopBodiesOf(spec)
    const bodies = new Map(loops.map((key) => [key, found.get(key) ?? new Set<string>()]))
    const loopOf = new Map<string, string>()
    for (const [loop, body] of bodies) for (const key of body) loopOf.set(key, loop)
    return { bodies, loopOf }
}

/**
 * The problems of a version's loops on a thread: a for-each inside another one's body (a thread holds one frame), and a body node a
 * node outside the loop also leads to (its way out would go back to the loop where the graph means the end). Empty for a graph with
 * no loop.
 */
export const loopProblemsOf = (spec: GraphSpec, shapes: LoopShapes): ReadonlyArray<LoopProblem> => {
    const nested = [...shapes.bodies.keys()]
        .filter((loop) => shapes.loopOf.has(loop))
        .map((at): LoopProblem => ({ code: "TEMPLATE_LOOP_NESTED", at }))
    const shared = new Set<string>()
    for (const node of spec.nodes) {
        const own = shapes.loopOf.get(node.key)
        const body = shapes.bodies.get(node.key)
        const edges: ReadonlyArray<readonly [string, string]> = [
            ...Object.entries(node.routes ?? {}),
            ...(node.next === undefined ? [] : [["", node.next] satisfies [string, string]]),
        ]
        for (const [route, target] of edges) {
            const targetLoop = shapes.loopOf.get(target)
            // An edge into a body comes from a node of the same body, or is the loop's own `body` route.
            if (targetLoop === undefined || targetLoop === own) continue
            if (body !== undefined && targetLoop === node.key && route === LOOP_BODY_ROUTE) continue
            shared.add(target)
        }
    }
    return [...nested, ...[...shared].map((at): LoopProblem => ({ code: "TEMPLATE_LOOP_SHARED", at }))]
}

/** The business failure an iteration ended in, as the loop's output lists it. */
export interface ThreadLoopFailure {
    /** The stable code. */
    readonly code: string
    /** The words, in the run's language. */
    readonly message: string
}

/** A business failure, or null for an iteration that ended well. */
export type OptionalThreadLoopFailure = ThreadLoopFailure | null

/** How one iteration ended: the output of the body node it ended on, or the business failure it ended in. */
export interface ThreadLoopJoin {
    /** The iteration, from 0. */
    readonly index: number
    /** The output of the last body node; null for a failed iteration. */
    readonly output: LoopItem
    /** The business failure, or null. */
    readonly error: OptionalThreadLoopFailure
}

/** A join, or null when none is there. */
export type OptionalThreadLoopJoin = ThreadLoopJoin | null

/**
 * The loop in progress, as `state.loop` keeps it (plain JSON): the loop node, the iteration that runs, the whole list, the iterations
 * already joined and, between the end of an iteration and the loop node's next visit, how that iteration ended.
 */
export interface ThreadLoopFrame {
    /** The for-each node. */
    readonly nodeKey: string
    /** The iteration that runs, from 0. */
    readonly index: number
    /** The whole list, in order (at most the node's `max`). */
    readonly items: ReadonlyArray<LoopItem>
    /** The iterations joined so far, in order. */
    readonly joins: ReadonlyArray<ThreadLoopJoin>
    /** How the iteration `index` ended, once a body node left the body; null while it runs. */
    readonly ended: OptionalThreadLoopJoin
}

/** The frame of the loop in progress, or null when no loop runs. */
export type OptionalThreadLoopFrame = ThreadLoopFrame | null

/** The first node of a loop's body, or null for a loop whose body is empty. */
export type OptionalLoopBody = string | null

/** The loop node a node's body belongs to, or undefined for a node outside every loop. */
export type OptionalLoopNode = string | undefined

/** One iteration that ended well, in the loop's output. */
export interface ThreadLoopResult {
    /** The iteration. */
    readonly index: number
    /** The element it worked on. */
    readonly item: LoopItem
    /** The output of its last body node. */
    readonly output: LoopItem
}

/** One iteration that ended in a business failure, in the loop's output. */
export interface ThreadLoopFailed {
    /** The iteration. */
    readonly index: number
    /** The element it worked on. */
    readonly item: LoopItem
    /** The failure. */
    readonly error: ThreadLoopFailure
}

/** How the running iteration left the body: with the output of its last node, or with a business failure. */
export type IterationEnd =
    | {
          /** The output of the body node it ended on. */
          readonly output: LoopItem
      }
    | {
          /** The business failure it ended in. */
          readonly error: ThreadLoopFailure
      }

/** What a body node's input carries in the iteration that runs: the element and the loop. */
export type IterationInput = Pick<GraphNodeStepInput, "item" | "loop">

/** The output of a for-each once every iteration ran: the same shape the old engine writes (`summaryJsonOf`). */
export interface ThreadLoopSummary {
    /** The iterations that ended well, in order. */
    readonly results: ReadonlyArray<ThreadLoopResult>
    /** How many ended well. */
    readonly okCount: number
    /** The iterations that ended in a business failure, in order. */
    readonly failed: ReadonlyArray<ThreadLoopFailed>
}

/** Where the loop node sends the thread on a visit. */
export type ThreadLoopMove =
    | {
          /** An iteration starts: the frame to write and the first body node. */
          readonly kind: "iterate"
          /** The new `state.loop`. */
          readonly frame: ThreadLoopFrame
          /** The first node of the body. */
          readonly goto: string
      }
    | {
          /** Every iteration ran (or none had to): the loop's output; `state.loop` is cleared and the loop's own exit follows. */
          readonly kind: "summed"
          /** The loop node's output. */
          readonly output: ThreadLoopSummary
      }

/** What the loop node finds on a visit: no iteration ended yet (it runs the node and starts), or an iteration to join. */
export type LoopVisit =
    | {
          /** First visit (or a frame of another loop): the node runs, checks the list, and the loop starts. */
          readonly kind: "start"
      }
    | {
          /** An iteration just ended: it is joined, and the next one starts or the loop is summed. */
          readonly kind: "join"
          /** The move. */
          readonly move: ThreadLoopMove
      }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A join as the frame keeps it, or null when the value is none. */
const joinOf = (value: unknown): OptionalThreadLoopJoin => {
    if (!isRecord(value) || typeof value.index !== "number") return null
    const error = value.error
    return {
        index: value.index,
        output: value.output ?? null,
        error:
            isRecord(error) && typeof error.code === "string"
                ? { code: error.code, message: typeof error.message === "string" ? error.message : "" }
                : null,
    }
}

/** The frame `state.loop` holds, or null when no loop runs (or the value is not a frame). */
export const loopFrameOf = (value: unknown): OptionalThreadLoopFrame => {
    if (!isRecord(value)) return null
    const { nodeKey, index, items, joins } = value
    if (typeof nodeKey !== "string" || typeof index !== "number" || !Array.isArray(items) || !Array.isArray(joins)) return null
    return {
        nodeKey,
        index,
        items: items.map((item: unknown) => item ?? null),
        joins: joins.flatMap((join: unknown) => joinOf(join) ?? []),
        ended: joinOf(value.ended),
    }
}

/** The summary of a loop: each element in order, the ones whose iteration failed apart. */
export const loopSummaryOf = (items: ReadonlyArray<LoopItem>, joins: ReadonlyArray<ThreadLoopJoin>): ThreadLoopSummary => {
    const byIndex = new Map(joins.map((join) => [join.index, join]))
    const results: Array<ThreadLoopResult> = []
    const failed: Array<ThreadLoopFailed> = []
    items.forEach((item, index) => {
        const join = byIndex.get(index)
        if (join?.error != null) failed.push({ index, item, error: { ...join.error } })
        else results.push({ index, item, output: join?.output ?? null })
    })
    return { results, okCount: results.length, failed }
}

/** The move of a loop that starts: the first iteration, or the summary at once for an empty list or a loop with no body. */
export const loopStarted = (loopKey: string, body: OptionalLoopBody, items: ReadonlyArray<LoopItem>): ThreadLoopMove => {
    if (body === null || items.length === 0) return { kind: "summed", output: loopSummaryOf(items, []) }
    return { kind: "iterate", frame: { nodeKey: loopKey, index: 0, items: [...items], joins: [], ended: null }, goto: body }
}

/**
 * What the loop node finds on a visit: the iteration that ended, joined into the next move, when the frame is its own and says one
 * ended; otherwise a start.
 */
export const loopVisitOf = (loopKey: string, body: OptionalLoopBody, frame: OptionalThreadLoopFrame): LoopVisit => {
    if (frame === null || frame.nodeKey !== loopKey || frame.ended === null) return { kind: "start" }
    const joins = [...frame.joins.filter((join) => join.index !== frame.ended?.index), frame.ended]
    const next = frame.index + 1
    if (body !== null && next < frame.items.length)
        return {
            kind: "join",
            move: { kind: "iterate", frame: { ...frame, index: next, joins, ended: null }, goto: body },
        }
    return { kind: "join", move: { kind: "summed", output: loopSummaryOf(frame.items, joins) } }
}

/** The frame once the running iteration left the body: with the output it ended on, or its business failure. */
export const iterationEnded = (frame: ThreadLoopFrame, end: IterationEnd): ThreadLoopFrame => ({
    ...frame,
    ended:
        "error" in end
            ? { index: frame.index, output: null, error: { ...end.error } }
            : { index: frame.index, output: end.output, error: null },
})

/**
 * The step key a node runs under: `<node>[<index>]` for a body node in the iteration that runs (the key the old engine and lead memory
 * use), else its node key.
 */
export const loopStepKeyOf = (nodeKey: string, inLoop: OptionalLoopNode, frame: OptionalThreadLoopFrame): string =>
    inLoop !== undefined && frame !== null && frame.nodeKey === inLoop ? iterationKeyOf(nodeKey, frame.index) : nodeKey

/** What a body node's input carries in the iteration that runs: the element and the loop, as the old engine's step input does. */
export const iterationInputOf = (frame: ThreadLoopFrame): IterationInput => ({
    item: { value: frame.items[frame.index] ?? null, index: frame.index },
    loop: { nodeKey: frame.nodeKey, index: frame.index, items: frame.items },
})
