import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { TOOL } from "@nivo-lite/blocks-core"
import { nextKeyOf, STOP_STEP, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    NodeRunError,
    RightsDeniedError,
    ToolUndeclaredError,
    type NodeConfusion,
    type NodeRun,
    type StepFailure,
} from "@nivo-lite/agent-sdk/node"
import {
    AgentRunHandlersService,
    AgentRunsService,
    type AgentStepHandler,
    type OptionalStepPassOver,
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
import { AgentGraphRunNoticesService, workflowRefOf, type RunNotice } from "./agent-graph-run-notices.service"
import { AgentGraphStepMemoryService, bindNode, jsonOf, outOfRun, stepsOfRun } from "./agent-graph-step-memory.service"
import { AgentGraphTurnPolicyService } from "./agent-graph-turn-policy.service"
import {
    APPROVED_STEP_MARK,
    carriedStepInput,
    GRAPH_NODE_STEP_KIND,
    localeOf,
    nodeBlocks,
    type GraphNodeApproval,
    type GraphNodeStepInput,
} from "./policies/graph-flow.policy"
import { effectsBeyond } from "./policies/workflow-grant.policy"
import { WAITING_MEMBER } from "./policies/workflow-trigger.policy"
import { isLoop } from "./policies/for-each.policy"
import { listOf, loopsOver, type LoopMove } from "./policies/loop-steps.policy"
import { AgentGraphConversationHoldsService } from "./agent-graph-conversation-holds.service"
import { AgentGraphAiCoreService } from "./agent-graph-ai-core.service"
import {
    AI_CORE_FAILED,
    FOUNDER_ANSWERS_MEMBER,
    stuckFactsOf,
    isAiFailure,
    troubleOfConfusion,
    troubleOfFailure,
    troubleOfRefusal,
    troubleOfThrow,
    typedEndOf,
    type StepTrouble,
} from "./policies/step-trouble.policy"

/** The effect a tool approval raises the owner's item through. */
const RAISE_EFFECT: string = TOOL.workItemRaise

/** The action of the owner item that approves one tool call of a node. */
const TOOL_APPROVAL_ACTION = "approve_tool_call"

/** How long a tool call waits for its approval before it counts as refused. */
const APPROVAL_WAIT_MS = 24 * 60 * 60_000

/** How long a run parked on the owner's decision of an item (an order over the limit) waits before it counts as refused. */
const OWNER_WAIT_MS = 3 * 24 * 60 * 60_000

/** The fingerprint an owner's decision carries when it names no tool call: the decision of the item the node raised. */
const OWNER_DECISION = "owner-decision"

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
    ...waitingOf(trigger),
    ...answersOf(trigger),
})

/** What the founder answered to the report of the step that runs again, as the retry put it into the trigger scope. */
const answersOf = (trigger: StepJson): Pick<NodeTurn, "founderAnswers"> => {
    const listed: unknown = trigger[FOUNDER_ANSWERS_MEMBER]
    if (!Array.isArray(listed)) return {}
    const answers = listed.flatMap((one: unknown) => {
        if (typeof one !== "object" || one === null) return []
        const text: unknown = Reflect.get(one, "text")
        const at: unknown = Reflect.get(one, "at")
        return typeof text === "string" && typeof at === "string" ? [{ text, at }] : []
    })
    return answers.length === 0 ? {} : { founderAnswers: answers }
}

/** What of the run's customer waits for the founder, as the run's trigger scope carries it; nothing when nothing does. */
const waitingOf = (trigger: StepJson): Pick<NodeTurn, "waitingOnFounder"> => {
    const listed: unknown = trigger[WAITING_MEMBER]
    if (!Array.isArray(listed)) return {}
    const waiting = listed.flatMap((one: unknown) => {
        if (typeof one !== "object" || one === null) return []
        const step: unknown = Reflect.get(one, "step")
        const since: unknown = Reflect.get(one, "since")
        return typeof step === "string" && typeof since === "string" ? [{ step, since }] : []
    })
    return waiting.length === 0 ? {} : { waitingOnFounder: waiting }
}

/** The node refusal a capability's domain error reports for an effect it refused (`params.refusal`), or null for any other failure. */
const domainRefusalOf = (cause: unknown): string | null => {
    if (!isDomainError(cause)) return null
    const refusal = cause.params.refusal
    return typeof refusal === "string" ? refusal : null
}

/** Whether a node refused in a way no retry changes: a schema, a right, an undeclared effect or tool. */
const refused = (cause: unknown): cause is NodeRunError | RightsDeniedError | ToolUndeclaredError =>
    cause instanceof NodeRunError || cause instanceof RightsDeniedError || cause instanceof ToolUndeclaredError

/** What a node runs with once bound: its settings and its data. */
interface BoundInput {
    /** The settings. */
    readonly params: Readonly<Record<string, unknown>>
    /** The data. */
    readonly input: Readonly<Record<string, unknown>>
}

@Injectable()
/**
 * The step of one node of a node graph. It reads the node from the version the run was opened on, resolves the node's input from the
 * trigger and the outputs of the nodes done before, runs it through the node host under the run's grant (`AgentGraphsService.runGrantOf`), keeps its output, and writes
 * the step of the node that follows: the route of a condition's branch, else `next`. A `stop` node ends the run and does nothing. A node
 * that refuses (a schema, a right) fails the step at once; anything else is tried again by the engine. A compensable step undoes itself
 * when the engine compensates a run that failed before its first pivot. A side node (`blocking: false`) that fails past its tries is
 * passed over: recorded with its failure, the owner told, and the run goes on to the node that follows.
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
        private readonly notices: AgentGraphRunNoticesService,
        @Optional() private readonly tags?: AgentTagService,
        @Optional() private readonly memory?: AgentGraphStepMemoryService,
        @Optional() private readonly holds?: AgentGraphConversationHoldsService,
        @Optional() private readonly core?: AgentGraphAiCoreService,
        @Optional() private readonly policy?: AgentGraphTurnPolicyService,
        @Optional() private readonly runs?: AgentRunsService,
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
        if (isLoop(node) && input.join !== undefined)
            return this.moved(
                step,
                flow,
                node,
                input,
                loopsOver(this.flows).joined(flow, node, input, input.join, step.earlier),
            )
        const recalled = await this.memory?.recalled(step, input)
        if (recalled !== undefined && recalled !== null) {
            // A resume or replay of a step that already has its outcome in memory: never run the node (nor its AI) again.
            const next = this.nextOf(flow, node, recalled.output, input)
            return this.ended(step, input, { kind: "done", result: { output: recalled.output, effects: [] }, next })
        }
        const ran = await this.attempted(step, flow, node, input)
        if ("trouble" in ran) return this.troubled(step, flow, node, input, ran.trouble)
        if ("ask" in ran) return this.waitForApproval(step, input, ran)
        const parked = this.parkedOn(ran.output, input)
        if (parked !== null) return parked
        if (isLoop(node)) {
            const items = listOf((await this.boundOf(step, flow, node, input)).input.items)
            return this.moved(step, flow, node, input, loopsOver(this.flows).started(flow, node, input, items))
        }
        await this.memory?.remember(step, flow, node, input, {
            status: "done",
            output: jsonOf(ran.output),
            error: null,
        })
        const next = this.nextOf(flow, node, ran.output, input)
        return this.ended(step, input, { kind: "done", result: { output: ran.output, effects: ran.effects }, next })
    }

    /**
     * One try of the node, and the ONE place every way a step can fail to complete comes together: the node (or the binding of its
     * input) threw, an executor or the host refused, a business failure has no route the graph drew for it, or the node's own AI said
     * it is confused. Each is a `trouble`, a true fact for the AI core to decide on; none is handled by a branch of code or of a graph.
     * What is not a trouble passes: an output, and an approval to ask a person for.
     */
    private async attempted(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
    ): Promise<NodeRun | ToolAsk | { readonly trouble: StepTrouble }> {
        try {
            const ran = await this.ran(step, flow, node, input)
            if ("code" in ran) return { trouble: troubleOfRefusal(ran.code, ran.text) }
            if ("confusion" in ran) return { trouble: troubleOfConfusion(ran.confusion) }
            if ("failure" in ran) return { trouble: troubleOfFailure(ran.failure) }
            return ran
        } catch (cause) {
            return { trouble: troubleOfThrow(cause) }
        }
    }

    /**
     * True only when the run engine says, in so many words, that another try owns the step now (`holds` answered `false`). A step
     * with no engine to ask, and any other answer, is taken as its own: staying silent about a real stop is the worse mistake, so
     * silence needs the engine's explicit `false`, never the absence of an answer.
     */
    private async superseded(step: StepView): Promise<boolean> {
        if (this.runs === undefined) return false
        const holds: unknown = await this.runs.holds(step)
        return holds === false
    }

    /**
     * A step that could not complete goes to the AI core, once per try, before anything is parked. The AI core produces the step's
     * output (checked against the node's own schema; never for a node that runs effects): the step is done, marked as recovered by
     * the AI, and the run goes on. Or it reports: the team is told in its words with the engine's facts, the customer hears only what
     * it chose, and the step fails with the trouble's code, so the run stops there and its customer's workflow waits for the founder,
     * whose retry runs this step again. Only when the AI itself failed does the engine speak, with its static words and the facts.
     * The raw cause is always logged for developers.
     */
    private async troubled(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
        trouble: StepTrouble,
    ): Promise<StepAnswer> {
        this.notices.troubled(step, trouble)
        // A try another try took over says nothing: no AI core call, no report, no line to the customer. Its commit is fenced.
        if (await this.superseded(step)) return { kind: "failed", code: trouble.code }
        const turn = await this.toldTurnOf(step, flow, input)
        const subject = this.memory?.subjectOf(step, input) ?? null
        const given = await this.givenOf(step, flow, node, input)
        const scope = await this.scopeOrNull(step, flow, input)
        const decision =
            this.core === undefined || isAiFailure(trouble)
                ? { kind: "ai_failed" as const, code: AI_CORE_FAILED }
                : await this.core.decide({
                      turn,
                      nodeKey: node.key,
                      nodeStep: node.step,
                      trouble,
                      given,
                      trigger: input.trigger,
                      earlier: step.earlier,
                      memory: scope,
                      conversationId: turn.conversationId ?? subject?.conversationId ?? null,
                  })
        if (decision.kind === "output") {
            this.notices.recovered(step, trouble)
            await this.memory?.remember(step, flow, node, input, {
                status: "done",
                output: jsonOf(decision.output),
                error: null,
            })
            const next = this.nextOf(flow, node, decision.output, input)
            const recovered = { by: "ai", code: trouble.code, kind: trouble.kind }
            return this.ended(step, input, {
                kind: "done",
                result: { output: jsonOf(decision.output), effects: [], recovered },
                next,
            })
        }
        // Asked again after the AI core's call, which takes long enough for another try to have taken the step.
        if (await this.superseded(step)) return { kind: "failed", code: trouble.code }
        const facts = stuckFactsOf(
            {
                workflow: input.namespace ?? flow.moduleKey,
                nodeKey: node.key,
                nodeStep: node.step,
                runId: step.runId,
                subject: turn.subject === null ? null : `${turn.subject.kind}:${turn.subject.id}`,
            },
            trouble,
            given ?? {},
        )
        await this.notices.stuck(
            {
                step,
                turn,
                trigger: input.trigger,
                code: trouble.code,
                workflow: workflowRefOf(input.namespace ?? flow.moduleKey),
                nodeId: node.step,
                leadId: subject?.leadId ?? null,
            },
            {
                report:
                    decision.kind === "report"
                        ? { reason: decision.reason, question: decision.question, suggestions: decision.suggestions }
                        : null,
                customerLine: decision.kind === "report" ? decision.customerLine : null,
                facts,
                leadId: subject?.leadId ?? null,
            },
        )
        return { kind: "failed", code: trouble.code }
    }

    /** What the node was given, settings and data together, or null when even that cannot be bound. */
    private async givenOf(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
    ): Promise<Readonly<Record<string, unknown>> | null> {
        try {
            const bound = await this.boundOf(step, flow, node, input)
            return { ...bound.params, ...bound.input }
        } catch {
            return null
        }
    }

    /** The customer's memory across workflows as the node's refs read it, or null when there is none to read. */
    private async scopeOrNull(step: StepView, flow: GraphSpec, input: GraphNodeStepInput): Promise<unknown> {
        try {
            return (await this.memory?.scopeOf(step, flow, input))?.memory ?? null
        } catch {
            return null
        }
    }

    /** The input of the step of the node that follows: what the run carries (version, trigger, workflow, iteration), not the approval. */
    private carried(input: GraphNodeStepInput, nodeKey: string): GraphNodeStepInput {
        return carriedStepInput(input, nodeKey)
    }

    /**
     * A step after which the run's path goes on is answered as it is. A step that ends the path ends the agent's work in the trigger's
     * conversation: the right to speak in it goes to the next hand-off that waits, else back to the agent that opened the door.
     */
    private async ended(step: StepView, input: GraphNodeStepInput, answer: StepAnswer): Promise<StepAnswer> {
        const conversationId = textOf(input.trigger, "conversationId")
        const endsPath = answer.kind === "done" && answer.next.length === 0 && conversationId !== null
        if (endsPath && !(await this.holds?.keptAfter(step, input, conversationId)))
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
        if (!input.success) return endedOf(APPROVAL_UNREADABLE)
        const fingerprint = asked.success ? asked.data.fields.fingerprint : OWNER_DECISION
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
     * A run that died at a node step is never silent: the owner gets one review item per run, and a customer whose conversation the run
     * serves and who heard nothing from it yet gets the honest holding line once, in the run's language.
     */
    async deadLetter(step: StepView, code: string): Promise<void> {
        await this.notices.runStopped(this.noticeOf(step, code))
    }

    /**
     * A side node that failed past its tries: when the node (or its graph node) says `blocking: false`, the step is recorded with its
     * failure and the run goes on to the node that follows, as if the node had answered nothing. Null for a node that blocks its run.
     */
    async passOver(step: StepView, code: string): Promise<OptionalStepPassOver> {
        const parsed = stepInputSchema.safeParse(step.input)
        if (!parsed.success) return null
        const input = parsed.data
        const { flow } = await this.graphs.documentOf(step.workspaceId, step.agentId, input.versionId)
        const node = flow?.nodes.find((candidate) => candidate.key === input.nodeKey)
        if (flow === undefined || node === undefined) return null
        if (nodeBlocks(node, this.nodes.installed().nodes.get(node.step)?.blocking)) return null
        const answer = await this.ended(step, input, {
            kind: "done",
            result: { output: null, effects: [], failed: code, passedOver: true },
            next: this.nextOf(flow, node, null, input),
        })
        return answer.kind === "done" ? { result: answer.result, next: answer.next } : null
    }

    /** Tells the owner, once per step, that a side node failed and the run went on without it. */
    async sideFailed(step: StepView, code: string): Promise<void> {
        await this.notices.sidePassedOver(this.noticeOf(step, code))
    }

    /** The notice of a failed step: the turn and the trigger its row holds, or an empty trigger for a row it cannot read. */
    private noticeOf(step: StepView, code: string): RunNotice {
        const input = stepInputSchema.safeParse(step.input)
        const trigger = input.success ? input.data.trigger : {}
        const namespace = input.success ? (input.data.namespace ?? "") : ""
        return { step, turn: turnOf(step, trigger), trigger, code, workflow: workflowRefOf(namespace) }
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

    /**
     * Runs the node under the run's grant: the SDK refuses a right or a tool the grant does not hold, and a node whose effects the grant
     * of a workflow does not all hold is refused here before it runs, the same honest refusal (`RIGHTS_DENIED`) as a missing right.
     */
    /**
     * The wait of a node that raised an item and asked the run to stop until the owner decides it (`awaitingOwner` in its output): the run
     * parks on the item, and an approval runs the node again under its approval (the item is raised once, by the replay key) and goes on
     * to the node that follows. Null for any other node, and for the run that already has the owner's approval.
     */
    private parkedOn(output: unknown, input: GraphNodeStepInput): StepAnswer | null {
        if (input.approval !== undefined || typeof output !== "object" || output === null) return null
        const awaiting: unknown = Reflect.get(output, "awaitingOwner")
        const workItemId: unknown = Reflect.get(output, "workItemId")
        if (awaiting !== true || typeof workItemId !== "string") return null
        return { kind: "wait", workItemId, deadlineAt: new Date(this.clock.now().getTime() + OWNER_WAIT_MS) }
    }

    private async ran(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
    ): Promise<
        | NodeRun
        | ToolAsk
        | { readonly code: string; readonly text: string }
        | { readonly failure: StepFailure }
        | { readonly confusion: NodeConfusion }
    > {
        const grant = await this.graphs.runGrantOf(step.workspaceId, step.agentId, input.versionId)
        await this.holds?.speakFor(step, input, node.step)
        const [beyond] = effectsBeyond(this.nodes.installed().nodes.get(node.step)?.effects ?? [], grant)
        if (beyond !== undefined) return { code: new RightsDeniedError(beyond).code, text: `effect not granted: ${beyond}` }
        const approval = approvalOf(input)
        const bound = await this.boundOf(step, flow, node, input)
        try {
            return await this.host.run({
                nodeId: node.step,
                params: bound.params,
                input: bound.input,
                turn: await this.toldTurnOf(step, flow, input),
                grant: { rights: grant.rights, tools: grant.tools },
                key: replayKeyOf(step, input),
                ...(approval === undefined ? {} : { approval }),
            })
        } catch (cause) {
            const typed = typedEndOf(cause)
            if (typed !== null) return typed
            if (refused(cause)) return { code: cause.code, text: cause.message }
            const refusal = domainRefusalOf(cause)
            if (refusal !== null) return { code: refusal, text: cause instanceof Error ? cause.message : refusal }
            const asked = askOf(cause)
            if (asked !== null) return asked
            throw cause
        }
    }

    /**
     * The turn a model call of the step is made in: the turn of the run, with what its agent is told beyond the step's goal (the
     * guidance and the values of the policy of the workflow's module, and the lines the step already sent when it runs again). An
     * app that holds no policy reader runs the plain turn.
     */
    private async toldTurnOf(step: StepView, flow: GraphSpec, input: GraphNodeStepInput): Promise<NodeTurn> {
        const turn = turnOf(step, input.trigger)
        return this.policy === undefined ? turn : this.policy.toldOf(turn, flow.moduleKey, replayKeyOf(step, input))
    }

    /** The params and input of a node: from its one binding place, resolved against the run, the lead memory and the trigger. */
    private async boundOf(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
    ): Promise<BoundInput> {
        if (this.memory !== undefined) return this.memory.bind(node, await this.memory.scopeOf(step, flow, input))
        // Without the lead-memory capability: refs read this run and the trigger only.
        const item =
            input.item === undefined ? {} : { item: { value: jsonOf(input.item.value), index: input.item.index } }
        const steps = stepsOfRun(step, input.versionId)
        const out = outOfRun(flow, steps)
        const scope = {
            trigger: input.trigger,
            steps,
            namespace: "",
            memory: null,
            ...item,
            ...(out === undefined ? {} : { out }),
        }
        return bindNode(this.nodes.installed().nodes.get(node.step), node, scope)
    }

    private nextOf(
        flow: GraphSpec,
        node: GraphSpecNode,
        output: unknown,
        input: GraphNodeStepInput,
    ): ReadonlyArray<ReturnType<AgentGraphFlowRunsService["stepOf"]>> {
        const key = nextKeyOf(node, output)
        const following = flow.nodes.find((candidate) => candidate.key === key)
        // The approval belongs to the node that asked for it: the nodes that follow run under their own step keys.
        if (following === undefined)
            return loopsOver(this.flows).ended(flow, input, { output: jsonOf(output), error: null })
        return [this.flows.stepOf(following, this.carried(input, following.key))]
    }

    /** Where a loop goes after one of its steps: the next iteration, else its summary kept as its output and the node after it. */
    private async moved(
        step: StepView,
        flow: GraphSpec,
        node: GraphSpecNode,
        input: GraphNodeStepInput,
        move: LoopMove,
    ) {
        if (move.kind === "iterate") return { kind: "done" as const, result: move.result, next: [move.step] }
        await this.memory?.remember(step, flow, node, move.outside, {
            status: "done",
            output: jsonOf(move.summary),
            error: null,
        })
        const next = this.nextOf(flow, node, move.summary, move.outside)
        return this.ended(step, input, { kind: "done", result: move.result, next })
    }
}
