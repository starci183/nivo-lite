import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { nextKeyOf, STOP_STEP, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    NodeRunError,
    resolveInput,
    RightsDeniedError,
    ToolUndeclaredError,
    type NodeRun,
} from "@nivo-lite/agent-sdk/node"
import {
    AgentRunHandlersService,
    type AgentStepHandler,
    type StepAnswer,
    type StepDecision,
    type StepJson,
    type StepView,
} from "@modules/domain/agent-runs"
import { AgentTagService } from "@modules/domain/agent-work"
import {
    GraphNodeHostService,
    GraphNodeRegistryService,
    GraphNodesError,
    GraphNodesErrorCode,
    type NodeToolApproval,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { isDomainError } from "@modules/platform/errors"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { askedSchema, doneSchema, stepInputSchema, subjectSchema } from "./agent-graph-node-step.schema"
import {
    APPROVED_STEP_MARK,
    GRAPH_NODE_STEP_KIND,
    localeOf,
    outputsOf,
    type GraphNodeApproval,
    type GraphNodeStepInput,
} from "./policies/graph-flow.policy"

/** The effect a dead run raises the owner's review through, and the action of that work. */
const RAISE_EFFECT = "work-item.raise"
const RUN_REVIEW_ACTION = "review_agent_run"

/** The action of the owner item that approves one tool call of a node. */
const TOOL_APPROVAL_ACTION = "approve_tool_call"

/** How long a tool call waits for its approval before it counts as refused. */
const APPROVAL_WAIT_MS = 24 * 60 * 60_000

/** Who closes a wait whose deadline passed. */
const TIMEOUT_ACTOR = "timeout"

/** Why a step that waited for an approval ended without running its node again. */
const OWNER_REFUSED = "owner_refused"
const APPROVAL_EXPIRED = "approval_expired"
const APPROVAL_UNREADABLE = "approval_unreadable"
const APPROVAL_UNAVAILABLE = "approval_unavailable"

/** Why a step cannot run: its row does not hold what a node step needs, or its version holds no such node. */
const INVALID_INPUT = "invalid_step_input"
const NODE_MISSING = "graph_node_missing"

/** The tool call a person is asked about: the tool, the fingerprint of the exact call, and why the grant asked. */
interface ToolAskCall {
    /** The capability tool. */
    readonly tool: string
    /** The fingerprint of the tool and its arguments. */
    readonly fingerprint: string
    /** Why the grant asked a person. */
    readonly reason: string
}

/** A node run that stopped for a person's approval of one tool call. */
interface ToolAsk {
    /** The call the person is asked about. */
    readonly ask: ToolAskCall
}

/** The text of a member of an error's params, or an empty text. */
const paramOf = (params: Readonly<Record<string, unknown>> | undefined, name: string): string => {
    const value = params?.[name]
    return typeof value === "string" ? value : ""
}

/** The ask of a node that stopped for an approval, or null for any other failure. */
const askOf = (cause: unknown): ToolAsk | null => {
    if (!(cause instanceof GraphNodesError) || cause.code !== GraphNodesErrorCode.ToolApprovalRequired) return null
    const tool = paramOf(cause.params, "tool")
    const fingerprint = paramOf(cause.params, "fingerprint")
    return fingerprint === "" ? null : { ask: { tool, fingerprint, reason: paramOf(cause.params, "reason") } }
}

/** The key the node runs under: the step that asked for an approval, so a run after it repeats no effect and no call. */
const replayKeyOf = (step: StepView, input: GraphNodeStepInput): string =>
    `${step.runId}:${input.approval?.stepKey ?? step.stepKey}`

/** The approval a step hands the host, or none. */
const approvalOf = (input: GraphNodeStepInput): NodeToolApproval | undefined =>
    input.approval === undefined ? undefined : { by: input.approval.by, fingerprint: input.approval.fingerprint }

/** The result of a step that waited for a person and ends there: no output, no effect, and why. */
const endedOf = (reason: string): StepAnswer => ({
    kind: "done",
    result: { output: null, effects: [], failed: reason },
    next: [],
})

/** The id of a string member of the trigger, or null. */
const textOf = (trigger: StepJson, member: string): string | null => {
    const value = trigger[member]
    return typeof value === "string" ? value : null
}

/** The subject a trigger names: `{ kind, id }` as the scope parsed it, else none; the host's resolvers fill a turn without one. */
const subjectOf = (trigger: StepJson): NodeTurn["subject"] => {
    const parsed = subjectSchema.safeParse(trigger.subject)
    return parsed.success ? parsed.data : null
}

/** The turn a node runs in: the run is the turn, about the trigger's subject, in its conversation and language, for whom it acts. */
const turnOf = (step: StepView, trigger: StepJson): NodeTurn => ({
    turnId: step.runId,
    workspaceId: step.workspaceId,
    agentId: step.agentId,
    subject: subjectOf(trigger),
    conversationId: textOf(trigger, "conversationId"),
    locale: localeOf(trigger),
    origin: trigger.origin === "channel" ? "customer" : "system",
    memberId: textOf(trigger, "actorMemberId"),
    handedOffBy: textOf(trigger, "authorAgentId"),
})

/** The node refusal a capability's domain error reports for an effect it refused (`params.refusal`), or null for any other failure. */
const domainRefusalOf = (cause: unknown): string | null => {
    if (!isDomainError(cause)) return null
    const refusal = cause.params.refusal
    return typeof refusal === "string" ? refusal : null
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
export class AgentGraphNodeStepService implements AgentStepHandler, OnModuleInit {
    /** The kind it runs. */
    readonly kind: string = GRAPH_NODE_STEP_KIND

    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly graphs: AgentGraphsService,
        private readonly host: GraphNodeHostService,
        private readonly flows: AgentGraphFlowRunsService,
        private readonly nodes: GraphNodeRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly tags?: AgentTagService,
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
        if (node.step === STOP_STEP)
            return this.ended(step, input, { kind: "done", result: { output: null, effects: [] }, next: [] })
        const ran = await this.ran(step, flow, node, input)
        if ("code" in ran) return { kind: "failed", code: ran.code }
        if ("ask" in ran) return this.waitForApproval(step, input, ran)
        const next = this.nextOf(flow, node, ran.output, input)
        return this.ended(step, input, { kind: "done", result: { output: ran.output, effects: ran.effects }, next })
    }

    /**
     * A step after which the run's path goes on is answered as it is. A step that ends the path ends the agent's work in the trigger's
     * conversation: the right to speak in it goes to the next hand-off that waits, else back to the agent that opened the door.
     */
    private async ended(step: StepView, input: GraphNodeStepInput, answer: StepAnswer): Promise<StepAnswer> {
        const conversationId = textOf(input.trigger, "conversationId")
        if (answer.kind === "done" && answer.next.length === 0 && conversationId !== null)
            await this.tags?.release(step.workspaceId, conversationId, step.agentId)
        return answer
    }

    /**
     * The verdict on a tool call the node asked a person for. Approved, the node runs again in a step of its own under the key of the step
     * that asked, carrying the approval of exactly the call the person saw: the call runs as approved, changed arguments ask again, and
     * the effects of the first try are not repeated. Refused, or not answered before the deadline, the step ends there with why.
     */
    onDecided(step: StepView, decision: StepDecision): StepAnswer {
        if (!decision.approved || decision.by === null)
            return endedOf(decision.by === TIMEOUT_ACTOR ? APPROVAL_EXPIRED : OWNER_REFUSED)
        const asked = askedSchema.safeParse(decision.data)
        const input = stepInputSchema.safeParse(step.input)
        if (!asked.success || !input.success) return endedOf(APPROVAL_UNREADABLE)
        const fingerprint = asked.data.fields.fingerprint
        const stepKey = input.data.approval?.stepKey ?? step.stepKey
        const approval: GraphNodeApproval = { stepKey, by: decision.by, fingerprint }
        return {
            kind: "done",
            result: { output: null, effects: [], approval },
            next: [
                {
                    stepKey: `${stepKey}${APPROVED_STEP_MARK}${fingerprint.slice(0, 16)}`,
                    nodeKey: step.nodeKey,
                    kind: GRAPH_NODE_STEP_KIND,
                    effect: step.effect,
                    input: { ...input.data, approval },
                },
            ],
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

    /**
     * A run that died at a node step is never silent to the owner: one work item a person reviews, raised through `work-item.raise`
     * once per run, names the run, the node and why. The customer hears nothing from here.
     */
    async deadLetter(step: StepView, code: string): Promise<void> {
        const raise = this.nodes.optionalExecutorOf(RAISE_EFFECT)
        if (raise === undefined) return
        const input = stepInputSchema.safeParse(step.input)
        const turn = turnOf(step, input.success ? input.data.trigger : {})
        const payload = {
            action: RUN_REVIEW_ACTION,
            title: this.catalog.get("agentGraphs.runDead.title", {}, turn.locale),
            payload: { runId: step.runId, nodeKey: step.nodeKey, code, conversationId: turn.conversationId },
        }
        const dedupeKey = `graph-run-dead:${step.runId}`
        await raise.execute(turn, payload, { key: dedupeKey, dedupeKey })
    }

    /**
     * Opens the one owner item that approves the tool call (what, with which call, for which run) and makes the step wait for it until the
     * deadline: the run waits, it is not dead, and the sweep never retries it on its own.
     */
    private async waitForApproval(step: StepView, input: GraphNodeStepInput, { ask }: ToolAsk): Promise<StepAnswer> {
        const raise = this.nodes.optionalExecutorOf(RAISE_EFFECT)
        if (raise === undefined) return { kind: "failed", code: APPROVAL_UNAVAILABLE }
        const turn = turnOf(step, input.trigger)
        const asking = input.approval?.stepKey ?? step.stepKey
        const dedupeKey = `tool-approval:${step.runId}:${asking}:${ask.fingerprint}`
        const payload = {
            action: TOOL_APPROVAL_ACTION,
            title: this.catalog.get("agentGraphs.toolApproval.title", { tool: ask.tool }, turn.locale),
            payload: {
                runId: step.runId,
                nodeKey: step.nodeKey,
                tool: ask.tool,
                fingerprint: ask.fingerprint,
                reason: ask.reason,
                conversationId: turn.conversationId,
            },
        }
        const item = await raise.execute(turn, payload, { key: dedupeKey, dedupeKey })
        return {
            kind: "wait",
            workItemId: item.id,
            deadlineAt: new Date(this.clock.now().getTime() + APPROVAL_WAIT_MS),
        }
    }

    private async ran(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
    ): Promise<NodeRun | ToolAsk | { readonly code: string }> {
        const approval = approvalOf(input)
        try {
            return await this.host.run({
                nodeId: node.step,
                params: node.params ?? {},
                input: resolveInput(node.input ?? {}, { trigger: input.trigger, steps: outputsOf(step.earlier) }),
                turn: turnOf(step, input.trigger),
                grant: { rights: flow.grant.rights, tools: flow.grant.tools },
                key: replayKeyOf(step, input),
                ...(approval === undefined ? {} : { approval }),
            })
        } catch (cause) {
            if (refused(cause)) return { code: cause.code }
            const refusal = domainRefusalOf(cause)
            if (refusal !== null) return { code: refusal }
            const asked = askOf(cause)
            if (asked !== null) return asked
            throw cause
        }
    }

    private nextOf(
        flow: GraphSpec,
        node: GraphSpecNode,
        output: unknown,
        input: GraphNodeStepInput,
    ): ReadonlyArray<ReturnType<AgentGraphFlowRunsService["stepOf"]>> {
        const key = nextKeyOf(node, output)
        const following = flow.nodes.find((candidate) => candidate.key === key)
        return following === undefined ? [] : [this.flows.stepOf(following, { ...input, nodeKey: following.key })]
    }
}
