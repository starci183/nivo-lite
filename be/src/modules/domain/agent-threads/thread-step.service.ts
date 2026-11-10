import { Inject, Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/blocks-core"
import { workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    NodeRunError,
    RightsDeniedError,
    ToolUndeclaredError,
    type NodeConfusion,
    type NodeRun,
    type StepFailure,
} from "@nivo-lite/agent-sdk/node"
import { DECISION_ACTOR_UNKNOWN, TOOL_OUTCOME_UNKNOWN } from "@modules/domain/agent-runs"
import type { StepJson, StepView } from "@modules/domain/agent-runs"
import { AgentTagService } from "@modules/domain/agent-work"
import { CHAT_DELIVERY_UNKNOWN, ChatConversationsService, HOLDING_LINE_KEY_PREFIX } from "@modules/domain/chat-records"
import { GraphNodeHostService, GraphNodeRegistryService, GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { isDomainError } from "@modules/platform/errors"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import {
    AgentGraphAiCoreService,
    AgentGraphConversationHoldsService,
    AgentGraphFlowRunsService,
    AgentGraphRunNoticesService,
    AgentGraphStepMemoryService,
    AgentGraphTurnPolicyService,
    AgentGraphsService,
    AgentWorkflowRunsService,
    GRAPH_NODE_STEP_KIND,
    WAITING_MEMBER,
    effectsBeyond,
    isAiFailure,
    jsonOf,
    localeOf,
    nodeBlocks,
    stuckFactsOf,
    troubleOfConfusion,
    troubleOfFailure,
    troubleOfRefusal,
    troubleOfThrow,
    typedEndOf,
    type GraphNodeStepInput,
    type StepTrouble,
} from "@modules/domain/agent-graphs"
import { CHECKPOINT_LIMITS, DEFAULT_CHECKPOINT_LIMITS, THREAD_END, replayRunOf } from "@modules/integrations/langgraph"
import type { CheckpointLimits } from "@modules/integrations/langgraph"
import type { ReplayPortsOf, ThreadNodeAnswer, ThreadNodeScope, ThreadState } from "@modules/integrations/langgraph"
import { FREEZE_NODE, stepExitOf, type CompiledStep } from "./template-compiler.policy"
import {
    iterationEnded,
    iterationInputOf,
    loopFrameOf,
    loopStarted,
    loopStepKeyOf,
    loopVisitOf,
    type LoopItem,
    type OptionalThreadLoopFrame,
    type ThreadLoopMove,
} from "./compiler-loop.policy"
import { ThreadProjectionService } from "./thread-projection.service"
import { RunStopsService } from "./stops/run-stops.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import type { FounderAnswerJson, StopCardContext, StopKind, StopQuestion } from "./stops/run-stop.contracts"

/** The node of a thread graph one call runs, and what of the run it needs: bound to one pinned version, shared by every thread on it. */
export interface ThreadStepNode {
    /** The agent of the run. */
    readonly agentId: string
    /** The pinned workflow version (the thread's pin). */
    readonly versionId: string
    /** The graph of that version. */
    readonly flow: GraphSpec
    /** The compiled step of the node (0-3). */
    readonly step: CompiledStep
    /** The namespace of the workflow (`<moduleKey>.<workflowKey>`), or undefined for an agent's own graph. */
    readonly namespace: string | undefined
    /** The workflow the run is pinned to, or null. */
    readonly workflowId: string | null
    /** The replay wrapper of the LangGraph port (`GraphThreads.replayPortsOf`). */
    readonly replay: ReplayPortsOf
    /** The loop in progress when this visit began (`state.loop`), or null/absent outside every loop. Set by `run` for its own calls. */
    readonly frame?: OptionalThreadLoopFrame | undefined
}

/** How a visit leaves a step other than its own exit: the loop node's move (where it goes, the frame it writes). */
interface StepRoute {
    /** The node to go to instead of the step's exit. */
    readonly goto?: string | undefined
    /** The loop frame to write (`null` clears it). */
    readonly loop?: OptionalThreadLoopFrame | undefined
}

/** What the gate node of a thread graph needs: the run's agent and the language of its cards. */
export interface ThreadGateNode {
    /** The agent of the run. */
    readonly agentId: string
}

/** What a step that went to the gate leaves in `state.trouble`: the step and the question of its stop. */
export interface ThreadTrouble {
    /** The step that stopped (`<node>[<i>]` in an iteration of a loop). */
    readonly stepKey: string
    /** The graph node of that step, which the gate routes back to; absent in a trouble written before loops ran (= `stepKey`). */
    readonly nodeKey?: string | undefined
    /** The question of its stop, as the gate hands it to `scope.stop`. */
    readonly question: StopQuestion
    /** The language of the team, for the card when the stop resolves. */
    readonly locale: "vi" | "en"
}

/**
 * The codes of a step whose effect may or may not have happened (the call left, no answer came back): the old kernel's outcome-unknown
 * set, kept as it is. Such a step is never completed or re-run by a machine: it always stops for the founder, whatever the AI core says.
 */
export const OUTCOME_UNKNOWN: ReadonlySet<string> = new Set([TOOL_OUTCOME_UNKNOWN, CHAT_DELIVERY_UNKNOWN, DECISION_ACTOR_UNKNOWN])

/** Ends the node when the drive lost its lease: the abort's own reason (or an `Aborted` error) is thrown, so the port leaves the thread as its checkpoint says. */
const leaseHeld = (scope: ThreadNodeScope): void => {
    const signal = scope.signal
    if (signal?.aborted !== true) return
    throw signal.reason instanceof Error ? signal.reason : new Error("Aborted")
}

/**
 * The code of a step whose output is over the checkpoint ceiling: an engine stop (kind `engine`), since it is neither the AI's failure nor
 * business, and only a person can say what to do (answer so the step keeps less, retry, take over or skip).
 */
export const STEP_OUTPUT_TOO_LARGE = "step_output_too_large"

/** The most characters of a side step's error the founder's notice carries. */
const SIDE_TEXT_MAX = 400

/** The break between the fact lines of a notice. */
const LINE_BREAK = String.fromCharCode(10)

/** Why a node could not run at all: its key is not in the pinned version. */
const NODE_MISSING = "graph_node_missing"

/** The work item a step asks for when one of its tool calls waits for a person (the full approval flow is package 1-3). */
const APPROVAL_ASKED = "tool_approval_required"

/** The words of a step's trouble: what a node answered when it did not complete. */
type Ran =
    | NodeRun
    | { readonly code: string; readonly text: string }
    | { readonly failure: StepFailure }
    | { readonly confusion: NodeConfusion }
    | { readonly ask: unknown }

const textOf = (trigger: StepJson, member: string): string | null => {
    const value = trigger[member]
    return typeof value === "string" ? value : null
}

const isRecord = (value: unknown): value is StepJson => typeof value === "object" && value !== null && !Array.isArray(value)

/** The node of a step's trouble, written only for an iteration's step (`<node>[<i>]`): any other trouble stays as it always was. */
const nodeKeyIn = (view: StepView): { readonly nodeKey?: string } =>
    view.nodeKey === view.stepKey ? {} : { nodeKey: view.nodeKey }

/** The list a loop node's bound input names (`items`); none when the binding gave no list (the node itself refused such an input). */
const itemsOf = (input: unknown): ReadonlyArray<LoopItem> => {
    const items: unknown = isRecord(input) ? input.items : undefined
    return Array.isArray(items) ? items.map((item: unknown) => jsonOf(item) as LoopItem) : []
}

/** The founder's words the thread carries, kept only when each is `{ text, at }`. */
const founderAnswersOf = (state: ThreadState): ReadonlyArray<FounderAnswerJson> =>
    state.founderAnswers.flatMap((one) => {
        if (!isRecord(one)) return []
        const { text, at } = one
        return typeof text === "string" && typeof at === "string" ? [{ text, at }] : []
    })

/** What of the run's customer waits for the founder, as the trigger carries it. */
const waitingOf = (trigger: StepJson): Pick<NodeTurn, "waitingOnFounder"> => {
    const listed: unknown = trigger[WAITING_MEMBER]
    if (!Array.isArray(listed)) return {}
    const waiting = listed.flatMap((one: unknown) => {
        if (!isRecord(one)) return []
        const { step, since } = one
        return typeof step === "string" && typeof since === "string" ? [{ step, since }] : []
    })
    return waiting.length === 0 ? {} : { waitingOnFounder: waiting }
}

/** Whether a node refused in a way no retry changes: a schema, a right, an undeclared effect or tool. */
const refused = (cause: unknown): cause is NodeRunError | RightsDeniedError | ToolUndeclaredError =>
    cause instanceof NodeRunError || cause instanceof RightsDeniedError || cause instanceof ToolUndeclaredError

/** The refusal a capability's domain error reports for an effect it refused (`params.refusal`), or null. */
const domainRefusalOf = (cause: unknown): string | null => {
    if (!isDomainError(cause)) return null
    const refusal = cause.params.refusal
    return typeof refusal === "string" ? refusal : null
}

/** Whether a host refusal asks a person to approve one tool call. */
const asksApproval = (cause: unknown): boolean =>
    cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired

/** The tries an AI failure made and what each failed as, as plain facts (`AI_TASKS_*` carry `tries` and `failures`). */
const triesOf = (trouble: StepTrouble): ReadonlyArray<{ readonly name: string; readonly value: string }> => {
    const tries: unknown = trouble.data.tries
    const failures: unknown = trouble.data.failures
    return [
        ...(typeof tries === "number" ? [{ name: "tries", value: String(tries) }] : []),
        ...(typeof failures === "string" ? [{ name: "failures", value: failures }] : []),
        ...(Array.isArray(failures) ? [{ name: "failures", value: failures.map(String).join(", ") }] : []),
    ]
}

@Injectable()
/**
 * The node function of a thread: one step of a workflow on LangGraph. It is the body of the old node step (`ran`, `attempted`,
 * `troubled`) on a thread's state instead of step rows: bind the node from the trigger, the outputs of the steps done before and the
 * customer's memory; compute the run's grant; run the node through the node host under the key `<run>:<step>` (the same on every attempt)
 * with the thread's replay ports; keep the output and go to the step that follows.
 *
 * Everything that keeps the step from completing (a failure before the node runs, such as the grant, the turn policy or the binding; a
 * throw; a refusal; a business failure; the node's AI being confused) is ONE trouble, handed to the AI core: it produces the step's output
 * (the run goes on) or reports, and the step stops for the founder with the AI's words (a stop of kind `ai_report`). Only when the AI
 * itself cannot be reached (all its tries spent) does the engine speak, with its static words and the tries (kind `ai_error`). A stop
 * goes to the engine's gate, whose decision sends the step back with the founder's words, keeps the thread at the gate, or ends it.
 */
export class ThreadStepService {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly host: GraphNodeHostService,
        private readonly nodes: GraphNodeRegistryService,
        private readonly stops: RunStopsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly core?: AgentGraphAiCoreService,
        @Optional() private readonly policy?: AgentGraphTurnPolicyService,
        @Optional() private readonly memory?: AgentGraphStepMemoryService,
        @Optional() private readonly holds?: AgentGraphConversationHoldsService,
        @Optional() private readonly tags?: AgentTagService,
        @Optional() private readonly notices?: AgentGraphRunNoticesService,
        @Optional() private readonly flows?: AgentGraphFlowRunsService,
        @Optional() private readonly projection?: ThreadProjectionService,
        @Optional() private readonly conversations?: ChatConversationsService,
        @Optional() private readonly workflowRuns?: AgentWorkflowRunsService,
        @Optional() @Inject(CHECKPOINT_LIMITS) private readonly limits: CheckpointLimits = DEFAULT_CHECKPOINT_LIMITS,
        @Optional() private readonly approvals?: ThreadApprovalsService,
    ) {}

    /** Steps whose last visit the checkpoint refused as too large, by `run:step`: the next visit stops them for the founder. */
    private readonly oversized = new Map<string, { readonly bytes: number; readonly limit: number }>()

    /**
     * The checkpoint refused what a visit of this step left (its output, or the calls it recorded) as over the ceiling: the drive that saw
     * the refusal marks the step, and drives again, so the step's next visit is an engine stop for the founder instead of the same refusal.
     */
    oversize(runId: string, stepKey: string, bytes: number, limit: number): void {
        this.oversized.set(`${runId}:${stepKey}`, { bytes, limit })
    }

    /** Runs the node of `at` for one visit of a thread: the step's output and the next node, or the gate with the stop's question. */
    async run(pinned: ThreadStepNode, state: ThreadState, scope: ThreadNodeScope): Promise<ThreadNodeAnswer> {
        // The loop in progress: a body node runs under `<node>[<i>]` with the element in its input; the loop node starts, joins or sums.
        const frame = loopFrameOf(state.loop)
        const at: ThreadStepNode = { ...pinned, frame }
        const { flow, step } = at
        const node = flow.nodes.find((candidate) => candidate.key === step.key)
        const trigger: StepJson = isRecord(state.trigger) ? state.trigger : {}
        const inBody = step.inLoop !== undefined && frame !== null && frame.nodeKey === step.inLoop
        const input: GraphNodeStepInput = {
            versionId: at.versionId,
            nodeKey: step.key,
            trigger,
            ...(at.namespace === undefined ? {} : { namespace: at.namespace }),
            workflowId: at.workflowId,
            ...(inBody ? iterationInputOf(frame) : {}),
        }
        const view = this.viewOf(at, state, scope, input)
        const turn = this.turnOf(view, trigger, state)
        // An iteration just ended: the loop node joins it and starts the next one (or sums the loop); the node itself does not run again.
        if (step.loop !== undefined && node !== undefined) {
            const visit = loopVisitOf(step.key, step.loop.body, frame)
            if (visit.kind === "join") return this.looped(at, view, input, node, turn, visit.move)
        }
        await this.started(at, view, input, state, node)
        const marked = this.oversized.get(`${view.runId}:${view.stepKey}`)
        if (marked !== undefined) {
            this.oversized.delete(`${view.runId}:${view.stepKey}`)
            return this.troubled(at, view, input, node, turn, {
                kind: "refused",
                code: STEP_OUTPUT_TOO_LARGE,
                text: `${String(marked.bytes)} > ${String(marked.limit)}`,
                data: { bytes: marked.bytes, limit: marked.limit },
            })
        }
        if (node === undefined) return this.troubled(at, view, input, node, turn, troubleOfRefusal(NODE_MISSING, step.key))
        const ran = await this.attempted(at, view, input, node, turn)
        // A lost lease (the drive's signal aborted) is no trouble of the step: the node ends here, silently, and the next driver runs the
        // step again from the checkpoint. Nothing is written: no AI core, no stop, no card, no projection.
        leaseHeld(scope)
        if ("ask" in ran) return this.asked(at, view, input, node, turn, ran.ask)
        if ("trouble" in ran) return this.troubled(at, view, input, node, turn, ran.trouble)
        // The loop node ran (it checked the list): the loop starts over the list its `items` bind to.
        if (step.loop !== undefined) {
            const bound = await this.boundOf(at, view, input, node)
            const move = loopStarted(step.key, step.loop.body, itemsOf(bound.input))
            if (move.kind === "iterate")
                return this.completed(at, view, input, node, turn, ran.output, ran.effects, undefined, {
                    goto: move.goto,
                    loop: move.frame,
                })
            return this.completed(at, view, input, node, turn, move.output, ran.effects, undefined, { loop: null })
        }
        return this.completed(at, view, input, node, turn, ran.output, ran.effects)
    }

    /** The loop node's visit after an iteration ended: the next iteration starts, or the loop's output completes the loop node. */
    private async looped(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        move: ThreadLoopMove,
    ): Promise<ThreadNodeAnswer> {
        if (move.kind === "iterate") return { update: { loop: move.frame }, goto: move.goto }
        return this.completed(at, view, input, node, turn, move.output, [], undefined, { loop: null })
    }

    /**
     * The engine's gate (`__freeze`): hands the stop's question to `scope.stop` (the thread waits for a person there) and, once a decision
     * resumes the thread, routes it through the stop: back to the step with every word the founder gave, back to itself, or to the end.
     */
    async gate(at: ThreadGateNode, state: ThreadState, scope: ThreadNodeScope): Promise<ThreadNodeAnswer> {
        const trouble = this.troubleOf(state)
        if (trouble === null) return { goto: THREAD_END }
        const decision = scope.stop<unknown>(trouble.question)
        const ref = { workspaceId: scope.thread.workspaceId, runId: scope.thread.runId }
        const route = await this.stops.decide(ref, trouble.stepKey, decision, FREEZE_NODE, { locale: trouble.locale })
        // A stop of an iteration is keyed `<node>[<i>]`; the thread goes back to the graph node (the frame still names the iteration).
        const goto = route.goto === trouble.stepKey ? (trouble.nodeKey ?? trouble.stepKey) : route.goto
        const by = isRecord(decision) && typeof decision.by === "string" ? decision.by : null
        // A take-over keeps the thread at the gate: the run keeps waiting, marked as held by a person, never `running`.
        if (route.goto === FREEZE_NODE) await this.projection?.takenOver(ref, by)
        else await this.projection?.resumed(ref, { at: this.clock.now() })
        // A skip ends the run here; the speaker goes back in the thread runs' end hook (0-8), never here, so it is released once.
        if (route.goto === THREAD_END)
            await this.projection?.runEnded(ref, { outcome: "skipped", code: "skipped_by_founder", by, at: this.clock.now() })
        void at
        return {
            update: { founderAnswers: route.founderAnswers, trouble: route.goto === FREEZE_NODE ? trouble : null },
            goto,
        }
    }

    /** One try of the node; every way it fails to complete is a trouble, including what fails before the node runs. */
    private async attempted(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
    ): Promise<NodeRun | { readonly trouble: StepTrouble } | { readonly ask: unknown }> {
        try {
            const ran = await this.ran(at, view, input, node, turn)
            if ("ask" in ran) return ran
            if ("code" in ran) return { trouble: troubleOfRefusal(ran.code, ran.text) }
            if ("confusion" in ran) return { trouble: troubleOfConfusion(ran.confusion) }
            if ("failure" in ran) return { trouble: troubleOfFailure(ran.failure) }
            return ran
        } catch (cause) {
            return { trouble: troubleOfThrow(cause) }
        }
    }

    /** Grant, speaker, binding, turn policy and the node host, in that order: a failure of any is the step's trouble. */
    private async ran(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
    ): Promise<Ran> {
        const grant = await this.graphs.runGrantOf(view.workspaceId, at.agentId, at.versionId)
        await this.holds?.speakFor(view, input, node.step)
        const [beyond] = effectsBeyond(this.nodes.installed().nodes.get(node.step)?.effects ?? [], grant)
        if (beyond !== undefined) return { code: new RightsDeniedError(beyond).code, text: `effect not granted: ${beyond}` }
        const bound = await this.boundOf(at, view, input, node)
        const told = this.policy === undefined ? turn : await this.policy.toldOf(turn, at.flow.moduleKey, `${view.runId}:${view.stepKey}`)
        // One replay per run of the node: the thread's wrapper of the host's ports, and in the same record the model turns of the host's
        // own agent loop (a node the AGENT_LOOP flag names), so a step that starts again asks the model nothing it already answered.
        const replayed = replayRunOf(at.replay)
        // The run after the owner approved carries exactly the approved call's fingerprint (and so does a later run of the step).
        const approval =
            (await this.approvals?.approvalOf({ workspaceId: view.workspaceId, runId: view.runId }, view.stepKey)) ?? null
        try {
            return await this.host.run({
                nodeId: node.step,
                params: bound.params,
                input: bound.input,
                turn: told,
                grant: { rights: grant.rights, tools: grant.tools },
                key: `${view.runId}:${view.stepKey}`,
                // The model the graph's node names (the shop's choice); absent, the host takes blocks-core's for the step.
                ...(node.model === undefined ? {} : { model: node.model }),
                replay: replayed.replay,
                record: replayed.record,
                ...(approval === null ? {} : { approval }),
            })
        } catch (cause) {
            const typed = typedEndOf(cause)
            if (typed !== null) return typed
            if (refused(cause)) return { code: cause.code, text: cause.message }
            const refusal = domainRefusalOf(cause)
            if (refusal !== null) return { code: refusal, text: cause instanceof Error ? cause.message : refusal }
            if (asksApproval(cause)) return { ask: cause }
            throw cause
        }
    }

    /**
     * A step that could not complete: the AI core decides, unless the trouble is the AI's own failure (all its tries spent). An output
     * completes the step as recovered; a report stops it with the AI's words and the customer line it chose; an AI failure stops it with
     * the engine's static words and the tries. The stop goes to the gate.
     */
    private async troubled(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode | undefined,
        turn: NodeTurn,
        trouble: StepTrouble,
    ): Promise<ThreadNodeAnswer> {
        this.notices?.troubled(view, trouble)
        const nodeStep = node?.step ?? view.nodeKey
        const byEngine = trouble.code === STEP_OUTPUT_TOO_LARGE
        // A side node (`blocking: false`) that fails is passed over: the thread goes on, the founder is told once. An outcome-unknown
        // failure still stops, side node or not: only a person may say whether its effect happened.
        if (
            node !== undefined &&
            !byEngine &&
            !OUTCOME_UNKNOWN.has(trouble.code) &&
            !nodeBlocks(node, this.nodes.installed().nodes.get(node.step)?.blocking)
        )
            return this.passedOver(at, view, input, node, turn, trouble)
        const given = node === undefined ? null : await this.givenOf(at, view, input, node)
        const subject = this.memory?.subjectOf(view, input) ?? null
        const leadId = subject?.leadId ?? (await this.leadOfConversation(view.workspaceId, turn.conversationId))
        const decision =
            this.core === undefined || isAiFailure(trouble) || node === undefined || byEngine
                ? null
                : await this.core.decide({
                      turn,
                      nodeKey: view.nodeKey,
                      nodeStep,
                      trouble,
                      given,
                      // The founder's words of this stop ride the trigger as the AI core's instructions read them (`founderAnswers`), so
                      // after an answer it does not ask the same thing again.
                      trigger:
                          turn.founderAnswers === undefined || turn.founderAnswers.length === 0
                              ? input.trigger
                              : { ...input.trigger, founderAnswers: [...turn.founderAnswers] },
                      earlier: view.earlier,
                      memory: await this.scopeOrNull(at, view, input),
                      conversationId: turn.conversationId ?? subject?.conversationId ?? null,
                  })
        // An outcome-unknown step never completes by the AI's output: only the founder decides whether it happened.
        if (decision?.kind === "output" && node !== undefined && !OUTCOME_UNKNOWN.has(trouble.code)) {
            this.notices?.recovered(view, trouble)
            return this.completed(at, view, input, node, turn, decision.output, [], { by: "ai", code: trouble.code, kind: trouble.kind })
        }
        const facts = stuckFactsOf(
            {
                workflow: input.namespace ?? at.flow.moduleKey,
                nodeKey: view.nodeKey,
                nodeStep,
                runId: view.runId,
                subject: turn.subject === null ? null : `${turn.subject.kind}:${turn.subject.id}`,
            },
            trouble,
            given ?? {},
        ).map(([name, value]) => ({ name, value }))
        const report = decision?.kind === "report" ? decision : null
        const kind: StopKind = byEngine ? "engine" : report === null ? "ai_error" : "ai_report"
        const card: StopCardContext = {
            locale: turn.locale === "en" ? "en" : "vi",
            workflow: await this.workflowRefOf(at, view, turn.locale),
            step: { key: view.stepKey, nodeId: nodeStep, title: this.stepTitleOf(nodeStep, turn.locale) ?? view.stepKey },
            by: report === null ? "engine" : "ai",
        }
        const question = await this.stops.stopped({
            workspaceId: view.workspaceId,
            runId: view.runId,
            stepKey: view.stepKey,
            agentId: at.agentId,
            workflowId: at.workflowId,
            leadId,
            conversationId: turn.conversationId,
            kind,
            reason:
                report?.reason ??
                this.catalog.get(
                    decision?.kind === "output" || byEngine ? "agentGraphs.stuck.engine" : "agentGraphs.stuck.aiFailed",
                    {},
                    turn.locale,
                ),
            question: report?.question ?? null,
            suggestions: report?.suggestions ?? [],
            facts: report === null ? [...facts, ...triesOf(trouble).filter((one) => !facts.some((fact) => fact.name === one.name))] : facts,
            card,
        })
        if (report?.customerLine !== null && report?.customerLine !== undefined)
            await this.customerLine(view, turn, report.customerLine, leadId)
        await this.projection?.stepStopped(
            { workspaceId: view.workspaceId, runId: view.runId },
            { ...this.factOf(view, input, node), code: trouble.code, error: { code: trouble.code, text: trouble.text }, calls: [], waitItemId: null },
        )
        const left: ThreadTrouble = { stepKey: view.stepKey, ...nodeKeyIn(view), question, locale: card.locale }
        return { update: { trouble: { ...left } }, goto: FREEZE_NODE }
    }

    /**
     * A call of the step asked for a person (an `ask` ability): the owner's item for exactly that call and the step's stop of kind
     * `approval`, then the gate. A call refused before, approved and still asking, or an ask that cannot be raised is the step's
     * trouble (the AI core reads it). Without the approvals service the ask stays the trouble it always was. The step row keeps
     * `waitItemId` null: a wait item on a thread row would let the old engine's item hook drive the thread run.
     */
    private async asked(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        cause: unknown,
    ): Promise<ThreadNodeAnswer> {
        const text = cause instanceof Error ? cause.message : APPROVAL_ASKED
        if (this.approvals === undefined) return this.troubled(at, view, input, node, turn, troubleOfRefusal(APPROVAL_ASKED, text))
        const locale = turn.locale === "en" ? "en" : "vi"
        const card: StopCardContext = {
            locale,
            workflow: await this.workflowRefOf(at, view, turn.locale),
            step: { key: view.stepKey, nodeId: node.step, title: this.stepTitleOf(node.step, turn.locale) ?? view.stepKey },
            by: "engine",
        }
        const leadId =
            this.memory?.subjectOf(view, input)?.leadId ?? (await this.leadOfConversation(view.workspaceId, turn.conversationId))
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        const asked = await this.approvals.asked(
            { ...ref, stepKey: view.stepKey, agentId: at.agentId, workflowId: at.workflowId, leadId, turn, card },
            cause,
        )
        if (asked.kind === "trouble") return this.troubled(at, view, input, node, turn, troubleOfRefusal(asked.code, asked.text))
        await this.projection?.stepStopped(ref, {
            ...this.factOf(view, input, node),
            code: APPROVAL_ASKED,
            error: { code: APPROVAL_ASKED, text: asked.question.reason },
            calls: [],
            waitItemId: null,
        })
        const left: ThreadTrouble = { stepKey: view.stepKey, ...nodeKeyIn(view), question: asked.question, locale }
        return { update: { trouble: { ...left } }, goto: FREEZE_NODE }
    }

    /** The step completed (or the AI core produced its output): kept in memory, its stop resolved, the next node named. */
    private async completed(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        output: unknown,
        effects: NodeRun["effects"],
        recovered?: StepJson,
        route: StepRoute = {},
    ): Promise<ThreadNodeAnswer> {
        const kept = jsonOf(output)
        // An output the checkpoint could not keep is no business and no AI failure: the engine stops the step for the founder before
        // anything of it is written (step row, memory, stop), instead of a write the saver refuses on every drive.
        const bytes = Buffer.byteLength(JSON.stringify({ [view.stepKey]: { output: kept } }), "utf8")
        if (bytes > this.limits.maxBytes)
            return this.troubled(at, view, input, node, turn, {
                kind: "refused",
                code: STEP_OUTPUT_TOO_LARGE,
                text: `${String(bytes)} > ${String(this.limits.maxBytes)}`,
                data: { bytes, limit: this.limits.maxBytes },
            })
        await this.memory?.remember(view, at.flow, node, input, { status: "done", output: kept, error: null })
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        await this.stops.completed(ref, view.stepKey, { locale: turn.locale === "en" ? "en" : "vi" })
        const result: StepJson = { output: kept, effects: jsonOf(effects), ...(recovered === undefined ? {} : { recovered }) }
        await this.projection?.stepEnded(ref, { ...this.factOf(view, input, node), result, calls: [], code: null, workItemId: null })
        const goto = route.goto ?? stepExitOf(at.step, output)
        if (goto === THREAD_END) await this.pathEnded(view, input, turn)
        const loop = route.loop !== undefined ? { loop: route.loop } : this.iterationLeft(at, goto, kept)
        return { update: { steps: { [view.stepKey]: { output: kept } }, trouble: null, ...loop }, goto }
    }

    /** A body node that goes back to its loop node ends the iteration: the frame keeps how it ended, for the loop node to join. */
    private iterationLeft(at: ThreadStepNode, goto: string, output: LoopItem): { readonly loop?: OptionalThreadLoopFrame } {
        const frame = at.frame ?? null
        if (frame === null || at.step.inLoop === undefined || goto !== at.step.inLoop || frame.nodeKey !== at.step.inLoop) return {}
        return { loop: iterationEnded(frame, { output }) }
    }

    /** The path ended: the right to speak in the conversation goes back unless the workflow keeps it. */
    private async pathEnded(view: StepView, input: GraphNodeStepInput, turn: NodeTurn): Promise<void> {
        const conversationId = turn.conversationId
        if (conversationId === null) return
        if (await this.holds?.keptAfter(view, input, conversationId)) return
        await this.tags?.release(view.workspaceId, conversationId, view.agentId)
    }

    /** The line the AI core chose for the customer, under the holding-line key of the stop, by the agent that speaks in the conversation. */
    private async customerLine(view: StepView, turn: NodeTurn, text: string, leadId: string | null): Promise<void> {
        const send = this.nodes.optionalExecutorOf(TOOL.customerMessageSend)
        const conversationId = turn.conversationId ?? (await this.conversationOfLead(view.workspaceId, leadId))
        if (send === undefined || conversationId === null) return
        // Once per run and step: the line is kept under this key, so a stop of the same step again sends no second line.
        const key = `${HOLDING_LINE_KEY_PREFIX}${view.runId}:${view.stepKey}`
        try {
            const found = await this.conversations?.turnOf(view.workspaceId, conversationId)
            const speaker = found?.kind === "ok" ? { ...turn, conversationId, agentId: found.value.agent.id } : { ...turn, conversationId }
            await send.execute(speaker, { conversationId, text }, { key, dedupeKey: key })
            await this.stops.lineSent({ workspaceId: view.workspaceId, runId: view.runId }, view.stepKey, {
                conversationId,
                text,
                at: this.clock.now().toISOString(),
            })
        } catch {
            // A line the channel refuses is not the step's failure: the team already has the card.
        }
    }

    private async conversationOfLead(workspaceId: string, leadId: string | null): Promise<string | null> {
        if (leadId === null || this.conversations === undefined) return null
        const [newest] = await this.conversations.ofLeads(workspaceId, [leadId])
        return newest?.id ?? null
    }

    /** The step began a try: its projection row. */
    private async started(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        state: ThreadState,
        node: GraphSpecNode | undefined,
    ): Promise<void> {
        void at
        void state
        await this.projection?.stepStarted({ workspaceId: view.workspaceId, runId: view.runId }, this.factOf(view, input, node))
    }

    /** The step's projection fact: the spec the old engine would have written, its place in the thread's path and its try. */
    private factOf(view: StepView, input: GraphNodeStepInput, node: GraphSpecNode | undefined) {
        const spec =
            node !== undefined && this.flows !== undefined
                ? this.flows.stepOf(node, input)
                : { stepKey: view.stepKey, nodeKey: view.nodeKey, kind: GRAPH_NODE_STEP_KIND, effect: view.effect, input: view.input }
        const ordinal = Object.keys(view.earlier).filter((key) => key !== view.stepKey).length + 1
        return { spec, ordinal, attempt: view.attempt, at: this.clock.now() }
    }

    /**
     * The step as the old services read it (the lead memory, the conversation lock, the AI core): run, step, the outputs of the steps done
     * before as `earlier`, and the try (one more than the stop's answers, so a run after a decision is the next try).
     */
    private viewOf(at: ThreadStepNode, state: ThreadState, scope: ThreadNodeScope, input: GraphNodeStepInput): StepView {
        const earlier = Object.fromEntries(
            Object.entries(state.steps).map(([key, value]): [string, StepJson] => [key, isRecord(value) ? value : { output: null }]),
        )
        return {
            stepKey: loopStepKeyOf(at.step.key, at.step.inLoop, at.frame ?? null),
            nodeKey: at.step.key,
            kind: GRAPH_NODE_STEP_KIND,
            effect: { kind: "read" },
            input: { ...input },
            runId: scope.thread.runId,
            workspaceId: scope.thread.workspaceId,
            agentId: at.agentId,
            status: "running",
            attempt: 1 + founderAnswersOf(state).length,
            fence: 0,
            result: null,
            earlier,
        }
    }

    /** The turn a node runs in: the run is the turn, with the founder's words of this stop and what waits for the founder. */
    private turnOf(view: StepView, trigger: StepJson, state: ThreadState): NodeTurn {
        const answers = founderAnswersOf(state)
        const subject: unknown = trigger.subject
        return {
            turnId: view.runId,
            workspaceId: view.workspaceId,
            agentId: view.agentId,
            subject:
                isRecord(subject) && typeof subject.kind === "string" && typeof subject.id === "string"
                    ? { kind: subject.kind, id: subject.id }
                    : null,
            conversationId: textOf(trigger, "conversationId"),
            locale: localeOf(trigger),
            origin: trigger.origin === "channel" ? "customer" : "system",
            memberId: textOf(trigger, "actorMemberId"),
            handedOffBy: textOf(trigger, "authorAgentId"),
            ...waitingOf(trigger),
            ...(answers.length === 0 ? {} : { founderAnswers: answers }),
        }
    }

    private async boundOf(at: ThreadStepNode, view: StepView, input: GraphNodeStepInput, node: GraphSpecNode) {
        if (this.memory === undefined) return { params: {}, input: {} }
        return this.memory.bind(node, await this.memory.scopeOf(view, at.flow, input))
    }

    private async givenOf(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
    ): Promise<Readonly<Record<string, unknown>> | null> {
        try {
            const bound = await this.boundOf(at, view, input, node)
            return { ...bound.params, ...bound.input }
        } catch {
            return null
        }
    }

    private async scopeOrNull(at: ThreadStepNode, view: StepView, input: GraphNodeStepInput): Promise<unknown> {
        try {
            return (await this.memory?.scopeOf(view, at.flow, input))?.memory ?? null
        } catch {
            return null
        }
    }

    /**
     * The workflow of the run as its card names it: its own stored name (the owner may have renamed it), else the name of the NIVO
     * template it was made from, else its key (the run-notices reading). A name that cannot be read never keeps the card from posting.
     */
    private async workflowRefOf(
        at: ThreadStepNode,
        view: StepView,
        locale: NodeTurn["locale"],
    ): Promise<StopCardContext["workflow"]> {
        const namespace = at.namespace ?? at.flow.moduleKey
        const dot = namespace.indexOf(".")
        const moduleKey = dot < 0 ? namespace : namespace.slice(0, dot)
        const key = dot < 0 ? "" : namespace.slice(dot + 1)
        const own = await this.workflowRuns
            ?.pinsOf(view.workspaceId, [view.runId])
            .then(([pin]) => pin?.workflowName ?? "")
            .catch(() => "")
        if (own !== undefined && own !== "") return { moduleKey, key, title: own }
        const template = workflowTemplateOf(`${moduleKey}.${key}`)
        const title = template === null ? (key === "" ? moduleKey : key) : locale === "en" ? template.name.en : template.name.vi
        return { moduleKey, key, title }
    }

    /** The customer of the run's conversation, when the run's memory names none (a consult stopped before the lead was ensured). */
    private async leadOfConversation(workspaceId: string, conversationId: string | null): Promise<string | null> {
        if (conversationId === null || this.conversations === undefined) return null
        try {
            return await this.conversations.leadIdOf(workspaceId, conversationId)
        } catch {
            return null
        }
    }

    /**
     * A side node that failed: passed over, the thread goes to its exit as if the node answered nothing, and the founder gets one
     * ordinary notice in the direct room (no stop, no decisions, no freeze) with the facts: which side step of which workflow did not
     * run and why. Posted once per run and step, by its key, so a replay posts nothing twice.
     */
    private async passedOver(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        trouble: StepTrouble,
    ): Promise<ThreadNodeAnswer> {
        const post = this.nodes.optionalExecutorOf(TOOL.teamMessagePost)
        const workflow = await this.workflowRefOf(at, view, turn.locale)
        const title = this.stepTitleOf(node.step, turn.locale) ?? view.stepKey
        const facts: ReadonlyArray<readonly [string, string]> = [
            ["workflow", workflow.title],
            ["step", `${title} (${node.step})`],
            ["code", trouble.code],
            ["error", trouble.text.slice(0, SIDE_TEXT_MAX)],
            ["run", view.runId],
        ]
        const key = `side-passed:${view.runId}:${view.stepKey}`
        if (post !== undefined) {
            await post.execute(
                turn,
                {
                    kind: "message.text",
                    intent: "notify",
                    audience: "founder",
                    title: this.catalog.get("agentGraphs.sideStepFailed.title", {}, turn.locale),
                    text: facts.map(([name, value]) => `- ${name}: ${value}`).join(LINE_BREAK),
                },
                { key, dedupeKey: key },
            )
        }
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        const result: StepJson = { output: null, effects: [], failed: trouble.code, passedOver: true }
        await this.projection?.stepEnded(ref, {
            ...this.factOf(view, input, node),
            result,
            calls: [],
            code: trouble.code,
            workItemId: null,
        })
        const goto = stepExitOf(at.step, null)
        if (goto === THREAD_END) await this.pathEnded(view, input, turn)
        return { update: { steps: { [view.stepKey]: { ...result } }, trouble: null, ...this.iterationLeft(at, goto, null) }, goto }
    }

    /** The title of an installed node in the team's language, or null. */
    private stepTitleOf(nodeId: string, locale: NodeTurn["locale"]): string | null {
        const title = this.nodes.installed().nodes.get(nodeId)?.title
        if (title === undefined) return null
        return "key" in title ? this.catalog.get(title.key, {}, locale) : locale === "en" ? title.en : title.vi
    }

    /** The trouble a step left for the gate, or null when the state holds none it can read. */
    private troubleOf(state: ThreadState): ThreadTrouble | null {
        const trouble = state.trouble
        if (!isRecord(trouble)) return null
        const { stepKey, nodeKey, question, locale } = trouble
        if (typeof stepKey !== "string" || !isRecord(question)) return null
        return {
            stepKey,
            ...(typeof nodeKey === "string" ? { nodeKey } : {}),
            question: question as unknown as StopQuestion,
            locale: locale === "en" ? "en" : "vi",
        }
    }
}
