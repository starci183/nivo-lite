import { STOP_STEP, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { LOOP_BODY_ROUTE } from "@nivo-lite/agent-sdk/node"
import {
    UNTIL_EXHAUSTED_ROUTE,
    UNTIL_ROUNDS_MAX,
    graphLoopProblemsOf,
    isUntilNode,
    untilBodiesOf,
    untilSettingsOf,
    type GraphLoopProblem,
} from "@modules/domain/agent-graphs"
import { THREAD_END } from "@modules/integrations/langgraph"
import { endingTargetsOf } from "./step-ending.policy"
import { FREEZE_NODE, type CompiledStep, type CompiledTemplate, type StepExit } from "./template-compiler.policy"

/*
 * `loop({ until })` on a thread, the compile half (owner 2026-11-12, "bam langgraph"): a CYCLE through LangGraph `Command`s. The loop
 * node goes to the first node of its body; every way out of the body (a node with nothing after it, a branch with no route, a `stop`,
 * an explicit edge back to the loop) goes back to the loop node; the loop node, visited again after a round, judges the condition and
 * answers `Command({ goto })` to the body's start (next round), to its `next` (the condition holds) or to its `exhausted` branch (`max`
 * rounds ran without it). The round counter is the engine's (`state.loop`, `until-rounds.policy.ts`); this file draws the shape the
 * thread compiler hands LangGraph and the recursion bound one drive needs. Pure.
 */

/** Where an until loop node may send the thread: the first node of its body, its `exhausted` branch and its `next`. */
export interface UntilTargets {
    /** The first node of the body. */
    readonly body: string
    /** The node after `max` rounds without the condition (`THREAD_END` for a `stop`). */
    readonly exhausted: string
    /** The node after the condition held (`THREAD_END` for none or a `stop`). */
    readonly next: string
}

/** The node name an edge to a key resolves to: the end for a `stop` node or an unknown key, else the key. */
const targetOf = (byKey: ReadonlyMap<string, GraphSpecNode>, key: string | undefined): string => {
    const node = key === undefined ? undefined : byKey.get(key)
    return node === undefined || node.step === STOP_STEP ? THREAD_END : node.key
}

/** The targets of an until loop node of the graph (its params and routes as written). */
export const untilTargetsOf = (spec: GraphSpec, loop: GraphSpecNode): UntilTargets => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    return {
        body: targetOf(byKey, loop.routes?.[LOOP_BODY_ROUTE]),
        exhausted: targetOf(byKey, loop.routes?.[UNTIL_EXHAUSTED_ROUTE]),
        next: targetOf(byKey, loop.next),
    }
}

/** An exit whose ends go back to the loop node instead of ending the run: how a round ends. */
const roundExitOf = (exit: StepExit, loopKey: string): StepExit => {
    const back = (to: string): string => (to === THREAD_END ? loopKey : to)
    if (exit.kind === "next") return { kind: "next", to: back(exit.to) }
    return {
        ...exit,
        routes: Object.fromEntries(Object.entries(exit.routes).map(([route, to]) => [route, back(to)])),
        otherwise: back(exit.otherwise),
    }
}

/** The targets of an exit, without repeats. */
const exitTargetsOf = (exit: StepExit): ReadonlyArray<string> =>
    exit.kind === "next" ? [exit.to] : [...new Set([...Object.values(exit.routes), exit.otherwise])]

/**
 * The compiled version with its until loops drawn as cycles: the loop node's exit is its `next`, and it may also go to its body's first
 * node and to its `exhausted` branch (each a `Command` target LangGraph checks); a body node is marked `inLoop` (it runs under the
 * round's step key) and every end of its exit goes back to the loop node. Every other step is kept as compiled. Pure.
 */
export const withUntilLoops = (compiled: CompiledTemplate, spec: GraphSpec): CompiledTemplate => {
    const bodies = untilBodiesOf(spec)
    if (bodies.size === 0) return compiled
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const loopOf = new Map<string, string>()
    for (const [loop, body] of bodies) for (const key of body) loopOf.set(key, loop)
    const stepOf = (step: CompiledStep): CompiledStep => {
        const node = byKey.get(step.key)
        if (node !== undefined && isUntilNode(node)) {
            const targets = untilTargetsOf(spec, node)
            return {
                ...step,
                exit: { kind: "next", to: targets.next },
                ends: [...new Set([targets.body, targets.exhausted, targets.next]), FREEZE_NODE],
            }
        }
        const loop = loopOf.get(step.key)
        if (loop === undefined) return step
        const exit = roundExitOf(step.exit, loop)
        // R68 + R75: a step's declared end outcome is a route of that step wherever it sits; from a round it leaves the loop (the step's
        // answer clears the frame), so it is NOT turned back to the loop node as the round's own ends are.
        const endings = node === undefined ? [] : endingTargetsOf(node).map((key) => targetOf(byKey, key))
        return { ...step, exit, inLoop: loop, ends: [...new Set([...exitTargetsOf(exit), ...endings]), FREEZE_NODE] }
    }
    return { ...compiled, nodes: compiled.nodes.map((step) => stepOf(step)) }
}

/**
 * The problems that refuse a version on a thread besides the template compiler's: the engine's loop and cycle checks
 * (`graphLoopProblemsOf`: a cycle not through a loop, an until loop's cap, body, `exhausted` branch, `every`, condition, nesting).
 */
export const untilCompileProblemsOf = (spec: GraphSpec): ReadonlyArray<GraphLoopProblem> => graphLoopProblemsOf(spec)

/**
 * The node visits ONE drive of a version may need, which the thread graph hands LangGraph as its recursion limit (the client takes the
 * larger of it and the app's `stepLimit`): every node once, the gate once, and per until loop `max` rounds of its body plus the loop
 * node's visit after each (`max × (body + 1)`, `max` read from its params, `UNTIL_ROUNDS_MAX` when unreadable). A cycle can only pass
 * through a loop (the save check and `untilCompileProblemsOf`), so this bound is reached only by a legal loop running out of rounds, and
 * the round counter, never LangGraph, is what stops it.
 */
export const untilStepBudgetOf = (spec: GraphSpec): number => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const rounds = [...untilBodiesOf(spec)].reduce((sum, [loop, body]) => {
        const max = untilSettingsOf(byKey.get(loop)?.params)?.max ?? UNTIL_ROUNDS_MAX
        return sum + max * (body.size + 1)
    }, 0)
    return spec.nodes.length + 1 + rounds
}
