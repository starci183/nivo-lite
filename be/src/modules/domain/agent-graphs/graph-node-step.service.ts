import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { z } from "zod"
import { nextKeyOf, STOP_STEP } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { NodeRunError, resolveInput, RightsDeniedError, ToolUndeclaredError } from "@nivo-lite/agent-sdk/node"
import type { NodeRun } from "@nivo-lite/agent-sdk/node"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepJson, StepView } from "@modules/domain/agent-runs"
import { GraphNodeHostService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { AgentGraphsService } from "./agent-graphs.service"
import { GraphFlowService } from "./graph-flow.service"
import { GRAPH_NODE_STEP_KIND, localeOf, outputsOf } from "./policies/graph-flow.policy"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

/** Why a step cannot run: its row does not hold what a node step needs, or its version holds no such node. */
const INVALID_INPUT = "invalid_step_input"
const NODE_MISSING = "graph_node_missing"

/** The effects a done node step ran, as its result keeps them. */
const doneSchema = z.object({
    effects: z.array(z.object({ id: z.string(), subject: z.object({ kind: z.string(), id: z.string() }) })),
})

const stepInputSchema: z.ZodType<GraphNodeStepInput> = z.object({
    versionId: z.string().min(1),
    nodeKey: z.string().min(1),
    trigger: z.record(z.string(), z.unknown()),
})

/** The id of a string member of the trigger, or null. */
const textOf = (trigger: StepJson, member: string): string | null => {
    const value = trigger[member]
    return typeof value === "string" ? value : null
}

/** The turn a node runs in: the run is the turn, about the trigger's subject, in its conversation and language. */
const turnOf = (step: StepView, trigger: StepJson): NodeTurn => {
    const subjectId = textOf(trigger, "subjectId")
    return {
        turnId: step.runId,
        workspaceId: step.workspaceId,
        agentId: step.agentId,
        subject: subjectId === null ? null : { kind: textOf(trigger, "subjectType") ?? "subject", id: subjectId },
        conversationId: textOf(trigger, "conversationId"),
        locale: localeOf(trigger),
    }
}

/** Whether a node refused in a way no retry changes: a schema, a right, an undeclared effect or tool. */
const refused = (cause: unknown): cause is NodeRunError | RightsDeniedError | ToolUndeclaredError =>
    cause instanceof NodeRunError || cause instanceof RightsDeniedError || cause instanceof ToolUndeclaredError

@Injectable()
/**
 * The step of one node of a node graph. It reads the node from the version the run was opened on, resolves the node's input from the
 * trigger and the outputs of the nodes done before, runs it through the node host under the graph's grant, keeps its output, and writes
 * the step of the node that follows: the route of a condition's branch, else `next`. A `stop` node ends the run and does nothing. A node
 * that refuses (a schema, a right) fails the step at once; anything else is tried again by the engine. A compensable step undoes itself
 * when the engine compensates a run that failed before its first pivot.
 */
export class GraphNodeStepService implements AgentStepHandler, OnModuleInit {
    /** The kind it runs. */
    readonly kind: string = GRAPH_NODE_STEP_KIND

    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly graphs: AgentGraphsService,
        private readonly host: GraphNodeHostService,
        private readonly flows: GraphFlowService,
    ) {}

    /** Registers with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Runs the node of the row and answers its output and the step that follows. */
    async run(step: StepView): Promise<StepAnswer> {
        const parsed = stepInputSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const input = parsed.data
        const { flow } = await this.graphs.documentOf(step.workspaceId, step.agentId, input.versionId)
        const node = flow?.nodes.find((candidate) => candidate.key === input.nodeKey)
        if (flow === undefined || node === undefined) return { kind: "failed", code: NODE_MISSING }
        if (node.step === STOP_STEP) return { kind: "done", result: { output: null, effects: [] }, next: [] }
        const ran = await this.ran(step, flow, node, input.trigger)
        if ("code" in ran) return { kind: "failed", code: ran.code }
        return {
            kind: "done",
            result: { output: ran.output, effects: ran.effects },
            next: this.nextOf(flow, node, ran.output, input),
        }
    }

    /**
     * Undoes a done compensable node step whose run failed before any pivot: the undo effect of each effect the step ran, last first, on
     * exactly the subjects its result kept from the ledger.
     */
    async compensate(step: StepView): Promise<void> {
        const input = stepInputSchema.parse(step.input)
        const { effects } = doneSchema.parse(step.result)
        await this.host.undo({ turn: turnOf(step, input.trigger), done: effects, key: `${step.runId}:${step.stepKey}` })
    }

    private async ran(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        trigger: StepJson,
    ): Promise<NodeRun | { readonly code: string }> {
        try {
            return await this.host.run({
                nodeId: node.step,
                params: node.params ?? {},
                input: resolveInput(node.input ?? {}, { trigger, steps: outputsOf(step.earlier) }),
                turn: turnOf(step, trigger),
                grant: { rights: flow.grant.rights, tools: flow.grant.tools },
                key: `${step.runId}:${step.stepKey}`,
            })
        } catch (cause) {
            if (refused(cause)) return { code: cause.code }
            throw cause
        }
    }

    private nextOf(
        flow: GraphSpec,
        node: GraphSpecNode,
        output: unknown,
        input: GraphNodeStepInput,
    ): ReadonlyArray<ReturnType<GraphFlowService["stepOf"]>> {
        const key = nextKeyOf(node, output)
        const following = flow.nodes.find((candidate) => candidate.key === key)
        return following === undefined ? [] : [this.flows.stepOf(following, { ...input, nodeKey: following.key })]
    }
}
