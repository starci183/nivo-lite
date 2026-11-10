import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { StepJson, StepSpec } from "@modules/domain/agent-runs"
import { bodyOf, joinJsonOf, joinsOf, summaryJsonOf, summaryOf } from "./for-each.policy"
import type { LoopFrame, LoopJoin, LoopValue } from "./for-each.policy"
import { carriedStepInput } from "./graph-flow.policy"
import type { GraphNodeStepInput } from "./graph-flow.policy"

/** Where a loop goes after one of its steps: the next iteration, or, after the last, the summary that is the loop's output. */
export type LoopMove =
    | {
          /** The next iteration starts with this step. */
          readonly kind: "iterate"
          /** The step of the first body node of the iteration. */
          readonly step: StepSpec
          /** What the loop step keeps. */
          readonly result: StepJson
      }
    | {
          /** Every iteration ran: the loop's output is the summary. */
          readonly kind: "summed"
          /** The summary, the loop's output. */
          readonly summary: StepJson
          /** What the loop step keeps. */
          readonly result: StepJson
          /** The input of the steps after the loop: outside it. */
          readonly outside: GraphNodeStepInput
      }

/** How a step of a node is written for the run, as the graph flows write it (`AgentGraphFlowRunsService.stepOf`). */
export interface NodeStepWriter {
    /** The step of a node with its input. */
    stepOf(node: GraphSpecNode, input: GraphNodeStepInput): StepSpec
}

/**
 * How the engine drives a `core.for-each` step: the body runs once per element, one iteration after the other, each under its own step
 * keys (`<node>[<index>]`) with `item` in scope, so a resume picks up the iteration it stopped in and never runs a done one again. The
 * end of an iteration (a body node with nothing after it) is joined on the loop (`<loop>#<index>`), with the output of its last node or
 * the business failure it ended in; after the last join the loop's output is the summary and the run goes on after the loop.
 */
export class LoopStepsPolicy {
    constructor(private readonly flows: NodeStepWriter) {}

    /** The move of a loop whose list passed its check: the first iteration, or the summary at once for an empty list or no body. */
    started(
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
        items: ReadonlyArray<LoopValue>,
    ): LoopMove {
        const body = bodyOf(flow, node)
        if (body === undefined || items.length === 0) {
            const summary = summaryJsonOf(summaryOf(items, []))
            return { kind: "summed", summary, result: { output: summary, effects: [] }, outside: this.outside(input) }
        }
        return {
            kind: "iterate",
            step: this.iteration(body, input, { nodeKey: node.key, index: 0, items }),
            result: { output: null, effects: [] },
        }
    }

    /** The move after the join of one iteration: the next one, or the summary after the last. */
    joined(
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
        join: LoopJoin,
        earlier: Readonly<Record<string, StepJson>>,
    ): LoopMove {
        const items = input.loop?.items ?? []
        const body = bodyOf(flow, node)
        const joined = joinJsonOf(join)
        if (body !== undefined && join.index + 1 < items.length) {
            const step = this.iteration(body, input, { nodeKey: node.key, index: join.index + 1, items })
            return { kind: "iterate", step, result: { output: null, effects: [], joined } }
        }
        const summary = summaryJsonOf(summaryOf(items, [...joinsOf(node.key, earlier), join]))
        return {
            kind: "summed",
            summary,
            result: { output: summary, effects: [], joined },
            outside: this.outside(input),
        }
    }

    /** The steps after a body node with nothing after it: the join of its iteration inside a loop, else none (the path ends). */
    ended(flow: GraphSpec, input: GraphNodeStepInput, ended: Omit<LoopJoin, "index">): ReadonlyArray<StepSpec> {
        const loop = input.loop
        const loopNode = loop === undefined ? undefined : flow.nodes.find((candidate) => candidate.key === loop.nodeKey)
        if (loop === undefined || loopNode === undefined || input.join !== undefined || input.nodeKey === loop.nodeKey)
            return []
        const join: LoopJoin = { index: loop.index, ...ended }
        return [this.flows.stepOf(loopNode, { ...carriedStepInput(this.outside(input), loopNode.key), loop, join })]
    }

    /** The step of the first body node in one iteration of a loop. */
    private iteration(body: GraphSpecNode, input: GraphNodeStepInput, loop: LoopFrame): StepSpec {
        const item = { value: loop.items[loop.index] ?? null, index: loop.index }
        return this.flows.stepOf(body, { ...carriedStepInput(this.outside(input), body.key), item, loop })
    }

    /** The input of a step outside the loop it ran in: no element, no frame, no join. */
    private outside(input: GraphNodeStepInput): GraphNodeStepInput {
        const { item: _item, loop: _loop, join: _join, ...outside } = input
        return outside
    }
}

/** The loop steps over the writer of the graph flows' steps. */
export const loopsOver = (flows: NodeStepWriter): LoopStepsPolicy => new LoopStepsPolicy(flows)

/** The list a loop's bindings hold; anything but a list is an empty one (the node itself refuses a list that is not one). */
export const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])
