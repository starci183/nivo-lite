import { Inject, Injectable, Optional } from "@nestjs/common"
import { TOOL, type CustomerMessageSendRefusal } from "@nivo-lite/agent-sdk/names"
import { INSTALLED, TEMPLATE_WAIT_STEP, installedStepIn } from "@modules/domain/installed-plugins"
import { PROVIDER_TRIGGER_MEMBER, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    FOREACH_ITEM_KEY_DUPLICATE,
    FOREACH_ITEM_KEY_MISSING,
    NodeRunError,
    RightsDeniedError,
    ToolUndeclaredError,
    type NodeConfusion,
    type NodeRun,
    type StepFailure,
} from "@nivo-lite/agent-sdk/node"
import { AgentRunsService, DECISION_ACTOR_UNKNOWN, TOOL_OUTCOME_UNKNOWN, type StepJson, type StepView } from "@modules/domain/agent-runs"
import { CHAT_DELIVERY_UNKNOWN, HOLDING_LINE_KEY_PREFIX } from "@nivo-lite/agent-sdk/customer-send"
import { ConversationContactsService } from "@modules/domain/contacts"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import {
    GraphNodeHostService,
    GraphNodeRegistryService,
    GraphNodesError,
    GraphNodesErrorCode,
    resolvedConditionHolds,
    type NodeStepRef,
    type NodeToolApproval,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { isDomainError } from "@modules/platform/errors"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import {
    AgentGraphAiCoreService,
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
    isUntilNode,
    jsonOf,
    localeOf,
    nodeBlocks,
    stuckFactsOf,
    troubleOfConfusion,
    troubleOfFailure,
    troubleOfRefusal,
    troubleOfThrow,
    typedEndOf,
    untilSettingsOf,
    type GraphNodeStepInput,
    type StepTrouble,
    type UntilSettings,
} from "@modules/domain/agent-graphs"
import {
    CHECKPOINT_LIMITS,
    DEFAULT_CHECKPOINT_LIMITS,
    THREAD_END,
    replayRunOf,
    type CheckpointLimits,
    type ReplayPortsOf,
    type ThreadNodeAnswer,
    type ThreadNodeScope,
    type ThreadSend,
    type ThreadState,
} from "@modules/integrations/langgraph"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import { FREEZE_NODE, stepExitOf, type CompiledStep } from "./template-compiler.policy"
import {
    branchGatheredOf,
    fanoutStarted,
    fanoutVisitOf,
    isFanoutFrame,
    itemBranchIdOf,
    iterationEnded,
    iterationInputOf,
    iterationPicked,
    loopBranchOf,
    loopFrameOf,
    loopListingOf,
    loopSettingsOf,
    loopStarted,
    loopStepKeyOf,
    loopVisitOf,
    type FanoutMove,
    type LoopBranch,
    type LoopItem,
    type LoopItemRecord,
    type OptionalLoopBody,
    type OptionalThreadLoopFrame,
    type ThreadLoopMove,
} from "./compiler-loop.policy"
import { untilTargetsOf } from "./compiler-until.policy"
import {
    inRound,
    meaningHolds,
    roundInputOf,
    roundLeft,
    roundStepKeyOf,
    untilFrameOf,
    untilJudged,
    untilParkOf,
    untilStarted,
    type OptionalUntilFrame,
    type UntilFrame,
} from "./until-rounds.policy"
import { UntilRoundTimersService } from "./until-round-timers.service"
import { runSubjectOf, timeoutMsOf, waitCameOf, waitOnOf, waitOutputOf, waitParkOf } from "./thread-waits.policy"
import { waitMatchKeysOf } from "./wait-match.policy"
import { HAND_BACK_NO_EVENT, HAND_BACK_WAIT_PARAM, TEMPLATE_HAND_BACK_STEP, handedOffByOf } from "./thread-hand-back.policy"
import { ThreadHandBacksService } from "./thread-hand-backs.service"
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
    /** The `loop({ until })` in progress when this visit began (`state.loop` of kind `until`), or null/absent. Set by `run`. */
    readonly until?: OptionalUntilFrame | undefined
}

/** How a visit leaves a step other than its own exit: the loop node's move (where it goes, the frame it writes). */
interface StepRoute {
    /** The node to go to instead of the step's exit. */
    readonly goto?: string | undefined
    /** The loop frame to write (`null` clears it). */
    readonly loop?: OptionalThreadLoopFrame | undefined
    /** A fan-out's branches instead of a `goto` (the loop node of a fan-out). */
    readonly sends?: ReadonlyArray<ThreadSend> | undefined
    /** The fan-out's item records to write (`null` empties them). */
    readonly branches?: Readonly<Record<string, LoopItemRecord>> | null | undefined
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
    /**
     * A fan-out's window only: the steps of EVERY item held in it, in list order (`stepKey` is the first). Each has its own open stop;
     * the founder's one decision is kept on all of them and sends every held item back to its failed node together.
     */
    readonly held?: ReadonlyArray<string> | undefined
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

/** Why an until loop's settings or its data condition could not be read on a visit: a graph bug only a person can fix. */
const UNTIL_CONDITION_UNREADABLE = "GRAPH_LOOP_CONDITION"

/** The code of a wait whose triggers, timeout or resume value the engine cannot read: an engine stop for a person. */
const WAIT_UNREADABLE = "GRAPH_WAIT_UNREADABLE"

/**
 * The codes of a step only a person can resolve, decided by the ENGINE, never by the AI core (which could otherwise "recover" the step
 * with an output and skip what the engine refused): the checkpoint ceiling, and a loop's list whose items cannot all be told apart.
 */
const ENGINE_STOP_CODES: ReadonlySet<string> = new Set([
    STEP_OUTPUT_TOO_LARGE,
    FOREACH_ITEM_KEY_DUPLICATE,
    FOREACH_ITEM_KEY_MISSING,
    UNTIL_CONDITION_UNREADABLE,
])

/** The most characters of a side step's error the founder's notice carries. */
const SIDE_TEXT_MAX = 400

/** The break between the fact lines of a notice. */
const LINE_BREAK = String.fromCodePoint(10)

/** Why a node could not run at all: its key is not in the pinned version. */
const NODE_MISSING = "graph_node_missing"

/** Why a side node was passed over without running: none of the providers it lists is connected to the agent (readiness). */
const SIDE_NODE_NOT_CONNECTED = "side_node_not_connected"

/** A name in both languages of the team. */
interface LocaleName {
    /** In English. */
    readonly en: string
    /** In Vietnamese. */
    readonly vi: string
}

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

/** The end code of a run whose step failed under a staff hold: the send door's own refusal of a held route (ruling R45). */
const ROUTE_HELD: CustomerMessageSendRefusal = "route_held"

/** The kind of the fact an effect answers when it refused (the SDK's refusal fact). */
const REFUSED_KIND = "refused"

/** The mark of a refusal the step's node made of the engine's own line (the customer send's executor writes it). */
const NODE_RULE = "node"

/** The words for a holding line the node does not hold at all: also the words of any reason this build does not name. */
const LINE_NOT_SENT_OFF = "agentGraphs.customerLineNotSent.off"

/** Why the node did not let the engine's line through, as the catalogue words it: by the judge's own reason codes. */
const LINE_NOT_SENT_WORDS: Readonly<Record<string, string>> = {
    ability_off: LINE_NOT_SENT_OFF,
    ask_mode: "agentGraphs.customerLineNotSent.ask",
    not_attached: "agentGraphs.customerLineNotSent.detached",
}

/** The most pinned versions whose workflow version is remembered at once. */
const NAMED_VERSIONS_KEPT = 1000

/** The member of a provider trigger's wake that says the agent's part for it (`wakeContextOf` of the provider triggers writes it). */
const TRIGGER_ROLE_MEMBER = "role"

/**
 * The part a run plays for the provider trigger that started it, read from two structured members of its trigger: the trigger it
 * came from (`providerTrigger`) and the part the emit point wrote (`role`). Undefined for a run no provider trigger started, and for
 * any other value: such a run is no notice run.
 */
const triggerRoleIn = (trigger: StepJson): NodeStepRef["triggerRole"] => {
    if (typeof trigger[PROVIDER_TRIGGER_MEMBER] !== "string") return undefined
    const role = trigger[TRIGGER_ROLE_MEMBER]
    return role === "decider" || role === "notice" ? role : undefined
}

/** The graph node a trouble names beside its step, present only for an iteration's step. */
interface TroubleNodePart {
    /** The graph node of the step (`<node>` of `<node>[<i>]`). */
    readonly nodeKey?: string
}

/** The loop frame a visit writes, present only when an iteration ended. */
interface LoopPart {
    /** The frame of the loop after the iteration. */
    readonly loop?: OptionalThreadLoopFrame
}

/** How a completed step ends: its output and effects, whether the AI core recovered it, and where the visit goes. */
interface StepEnding {
    /** The output of the node (or of the AI core, or of the loop). */
    readonly output: unknown
    /** The effects the node made. */
    readonly effects: NodeRun["effects"]
    /** The AI core's recovery of the step, when it produced the output. */
    readonly recovered?: StepJson | undefined
    /** Where the visit goes instead of the step's exit, and the loop frame it writes. */
    readonly route?: StepRoute | undefined
}

/** The AI core's answer to a trouble. */
type CoreDecision = Awaited<ReturnType<AgentGraphAiCoreService["decide"]>>

/** One visit of a step: the node bound to its version, the step as the services read it, its input and its turn. */
interface StepVisit {
    /** The node of the thread graph and its pinned version. */
    readonly at: ThreadStepNode
    /** The step as the old services read it. */
    readonly view: StepView
    /** The step's input. */
    readonly input: GraphNodeStepInput
    /** The turn the node runs in. */
    readonly turn: NodeTurn
}

/** A step's trouble as the AI core is asked about it. */
interface TroubleAsked extends StepVisit {
    /** What kept the step from completing. */
    readonly trouble: StepTrouble
    /** What the step was given (bound params and input), or null when the binding failed. */
    readonly given: Readonly<Record<string, unknown>> | null
    /** The installed node the step runs. */
    readonly nodeStep: string
}

/** The node of a step's trouble, written only for an iteration's step (`<node>[<i>]`): any other trouble stays as it always was. */
const nodeKeyIn = (view: StepView): TroubleNodePart =>
    view.nodeKey === view.stepKey ? {} : { nodeKey: view.nodeKey }

/** The list a loop node's bound input names (`items`); none when the binding gave no list (the node itself refused such an input). */
const itemsOf = (input: unknown): ReadonlyArray<LoopItem> => {
    const items: unknown = isRecord(input) ? input.items : undefined
    return Array.isArray(items) ? items.map((item: unknown) => jsonOf(item)) : []
}

/** The port's branches of a fan-out move: one `Send` per item, the item as the branch's value. */
const sendsOf = (move: Extract<FanoutMove, { readonly kind: "fan" }>): ReadonlyArray<ThreadSend> =>
    move.sends.map((one): ThreadSend => ({ node: one.node, branch: { ...one.branch } }))

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

/**
 * The words of a host refusal, as they read before the SDK's errors moved to one `DomainError` base: `<CODE>: <at>` (the node, tool or
 * effect it is about now rides in `params.at`, and the error's `message` is the code alone), or the code when it names no `at`.
 */
const refusalTextOf = (cause: NodeRunError | RightsDeniedError | ToolUndeclaredError): string => {
    const at: unknown = cause.params.at
    return typeof at === "string" && at !== "" ? `${cause.code}: ${at}` : cause.code
}

/** The refusal a capability's domain error reports for an effect it refused (`params.refusal`), or null. */
const domainRefusalOf = (cause: unknown): string | null => {
    if (!isDomainError(cause)) return null
    const refusal = cause.params.refusal
    return typeof refusal === "string" ? refusal : null
}

/** Whether a host refusal asks a person to approve one tool call. */
const asksApproval = (cause: unknown): boolean =>
    cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired

/** The kind of a stop: the engine's own, the AI core's report, or the AI's failure (no report). */
const stopKindOf = (byEngine: boolean, reported: boolean): StopKind => {
    if (byEngine) return "engine"
    return reported ? "ai_report" : "ai_error"
}

/** The words of a two-language name in the team's language (English for `en`, else Vietnamese). */
const localeText = (name: LocaleName, locale: NodeTurn["locale"]): string => (locale === "en" ? name.en : name.vi)

/**
 * What a node host's throw makes of the step: a typed end, a refusal (the node's, or a capability's domain refusal), or a person's
 * approval asked; anything else is thrown again as it was.
 */
const ranOfFailure = (cause: unknown): Ran => {
    const typed = typedEndOf(cause)
    if (typed !== null) return typed
    if (refused(cause)) return { code: cause.code, text: refusalTextOf(cause) }
    const refusal = domainRefusalOf(cause)
    if (refusal !== null) return { code: refusal, text: cause instanceof Error ? cause.message : refusal }
    if (asksApproval(cause)) return { ask: cause }
    throw cause
}

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


/** The most characters of a fault's stack one log line keeps. */
const STACK_LOG_MAX = 4000

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
        @Optional() private readonly notices?: AgentGraphRunNoticesService,
        @Optional() private readonly flows?: AgentGraphFlowRunsService,
        @Optional() private readonly projection?: ThreadProjectionService,
        @Optional() private readonly workflowRuns?: AgentWorkflowRunsService,
        @Optional() @Inject(CHECKPOINT_LIMITS) private readonly limits: CheckpointLimits = DEFAULT_CHECKPOINT_LIMITS,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
        @Optional() private readonly rounds?: UntilRoundTimersService,
        @Optional() private readonly contacts?: ConversationContactsService,
        @Optional() private readonly agentRuns?: AgentRunsService,
        @Optional() private readonly handBacks?: ThreadHandBacksService,
        @Optional() private readonly routes?: CustomerRoutesService,
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

    /**
     * Runs the node of `at` for one visit of a thread: the step's output and the next node, or the gate with the stop's question. Inside
     * a branch of a fan-out (`state.branch`: one item of a `loop({ over })` whose `concurrency` is above 1) the body node runs that
     * item exactly as the sequential loop runs it (its step key, its input), and its answer is the branch's: see `branched`.
     */
    async run(pinned: ThreadStepNode, state: ThreadState, scope: ThreadNodeScope): Promise<ThreadNodeAnswer> {
        const frame = loopFrameOf(state.loop)
        const branch = loopBranchOf(state.branch)
        if (branch === null) return this.visited(pinned, frame, state, scope)
        // The frame read at the branch's item: every key, input and gathering of the visit is that item's.
        const own = frame !== null && frame.nodeKey === branch.loop ? { ...frame, index: branch.index } : frame
        return this.branched(pinned, own, branch, state, await this.visited(pinned, own, state, scope))
    }

    /**
     * The answer of a body node in a branch, as the branch's: only its `steps` are written (the channels the branches of one superstep
     * share merge by key); a node it goes to inside the body continues the branch; a way out of the body (back to the loop node) JOINS:
     * the item's record says it ended, with the output the loop gathers for it; a stop (the gate) HOLDS the item: its record keeps the
     * node, the step and the trouble its stop left, and the branch joins too, so the items beside it go on. The stop itself (its card,
     * the AI core's report, the projection) was opened by the visit exactly as it is for the sequential loop.
     */
    private branched(
        pinned: ThreadStepNode,
        frame: OptionalThreadLoopFrame,
        branch: LoopBranch,
        state: ThreadState,
        answer: ThreadNodeAnswer,
    ): ThreadNodeAnswer {
        const steps = answer.update?.steps
        const written = steps === undefined ? {} : { steps }
        const id = itemBranchIdOf(branch.loop, branch.key)
        if (answer.goto === FREEZE_NODE) {
            const trouble: unknown = answer.update?.trouble
            const left = isRecord(trouble) ? trouble : {}
            const stepKey = typeof left.stepKey === "string" ? left.stepKey : loopStepKeyOf(pinned.step.key, pinned.step.inLoop, frame)
            const held: LoopItemRecord = { state: "held", nodeKey: pinned.step.key, stepKey, trouble: left }
            return { update: { ...written, branches: { [id]: held } }, goto: branch.loop, join: true }
        }
        if (answer.goto === branch.loop && frame !== null) {
            const stepKey = loopStepKeyOf(pinned.step.key, pinned.step.inLoop, frame)
            const output = branchGatheredOf(frame, branch, { ...state.steps, ...steps }, stepKey)
            const ended: LoopItemRecord = { state: "ended", output }
            return { update: { ...written, branches: { [id]: ended } }, goto: branch.loop, join: true }
        }
        return { update: written, ...(answer.goto === undefined ? {} : { goto: answer.goto }) }
    }

    /** One visit of the node of `pinned` with the loop frame it runs in (a branch's: at its item). */
    private async visited(
        pinned: ThreadStepNode,
        frame: OptionalThreadLoopFrame,
        state: ThreadState,
        scope: ThreadNodeScope,
    ): Promise<ThreadNodeAnswer> {
        // The loop in progress: a body node runs under `<node>[<i>]` with the element in its input; the loop node starts, joins or sums.
        const at: ThreadStepNode = { ...pinned, frame, until: untilFrameOf(state.loop) }
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
            // A node of a `loop({ until })` round: the round is its item (`r<round>`).
            ...(!inBody && at.until !== undefined && inRound(step, at.until) ? roundInputOf(at.until) : {}),
        }
        const view = this.viewOf(at, state, scope, input)
        const turn = this.turnOf(view, trigger, state)
        // A `loop({ until })` node: the engine drives its rounds (start, judge after a round, park between rounds, end).
        if (node !== undefined && isUntilNode(node)) return this.untilVisited({ at, view, input, turn }, node, scope)
        // A `wait` node: the engine parks the run until an event it takes or its timeout, and answers what came.
        if (node?.step === TEMPLATE_WAIT_STEP) return this.waitVisited({ at, view, input, turn }, node, scope, trigger)
        // A hand-back: the event its wait took is given back to the next waiter, then to the registered graphs; the run goes on.
        if (node?.step === TEMPLATE_HAND_BACK_STEP) return this.handBackVisited({ at, view, input, turn }, node)
        // An iteration just ended: the loop node joins it and starts the next one (or sums the loop); the node itself does not run again.
        // A fan-out's loop node is visited by every join of its window (and after the gate): it waits, sends, gates or sums.
        if (step.loop !== undefined && node !== undefined && frame !== null && frame.nodeKey === step.key && isFanoutFrame(frame))
            return this.fanned(at, view, input, node, turn, fanoutVisitOf(step.loop.body, frame, state.branches ?? {}))
        if (step.loop !== undefined && node !== undefined) {
            const visit = loopVisitOf(step.key, step.loop.body, frame)
            if (visit.kind === "join") return this.looped(at, view, input, node, turn, visit.move)
        }
        await this.started(view, input, node)
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
        // Readiness: a side node none of whose providers is connected is skipped on the passed-over path, naming what it waits for.
        const waiting = await this.workflowRuns?.sideNodeWaiting(
            { workspaceId: view.workspaceId, agentId: at.agentId, workflowId: at.workflowId },
            node,
        )
        if (waiting !== undefined && waiting !== null) {
            return this.passedOver(at, view, input, node, turn, troubleOfRefusal(SIDE_NODE_NOT_CONNECTED, waiting.join(", ")))
        }
        const ran = await this.attempted(at, view, input, node, turn)
        // A lost lease (the drive's signal aborted) is no trouble of the step: the node ends here, silently, and the next driver runs the
        // step again from the checkpoint. Nothing is written: no AI core, no stop, no card, no projection.
        leaseHeld(scope)
        if ("ask" in ran) return this.asked(at, view, input, node, turn, ran.ask)
        if ("trouble" in ran) return this.troubled(at, view, input, node, turn, ran.trouble)
        if (step.loop !== undefined) return this.loopBegun({ at, view, input, turn }, node, ran, step.loop.body)
        return this.completed(at, view, input, node, turn, { output: ran.output, effects: ran.effects })
    }

    /**
     * The loop node ran (it checked the list): the loop starts over the list its `items` bind to, with the settings of its params
     * (`max`, `collect`, `itemKey`, read as the graph wrote them, `@1` or `@2`). A list whose items cannot all be told apart (a repeated
     * or a missing identity) stops the loop node for a person before any item runs.
     */
    private async loopBegun(
        visit: StepVisit,
        node: GraphSpecNode,
        ran: NodeRun,
        body: OptionalLoopBody,
    ): Promise<ThreadNodeAnswer> {
        const { at, view, input, turn } = visit
        const bound = await this.boundOf(at, view, input, node)
        const settings = loopSettingsOf({ ...node.params, ...bound.params })
        const listing = loopListingOf(itemsOf(bound.input), settings)
        if (listing.kind === "refused")
            return this.troubled(at, view, input, node, turn, {
                kind: "refused",
                code: listing.code,
                text: listing.text,
                data: { index: listing.index },
            })
        if (settings.concurrency > 1) {
            const fanned = fanoutStarted(at.step.key, body, listing, settings.concurrency)
            if (fanned.kind === "fan")
                return this.completed(at, view, input, node, turn, {
                    output: ran.output,
                    effects: ran.effects,
                    route: { loop: fanned.frame, sends: sendsOf(fanned), branches: fanned.records },
                })
            if (fanned.kind === "summed")
                return this.completed(at, view, input, node, turn, {
                    output: fanned.output,
                    effects: ran.effects,
                    route: { loop: null, branches: null },
                })
        }
        const move = loopStarted(at.step.key, body, listing)
        if (move.kind === "iterate")
            return this.completed(at, view, input, node, turn, {
                output: ran.output,
                effects: ran.effects,
                route: { goto: move.goto, loop: move.frame },
            })
        return this.completed(at, view, input, node, turn, { output: move.output, effects: ran.effects, route: { loop: null } })
    }

    /**
     * A visit of a `loop({ until })` node (`TEMPLATE_UNTIL_STEP`). No frame of its own: round 1 starts (`Command` to the body's first
     * node). After a round ended: the condition is judged, by DATA (the expression, its refs resolved in the round's scope, decided by the
     * engine's one evaluator) or by MEANING (the route the named body node took this round); it holds: the loop's output and `next`;
     * `max` rounds ran: the output and `exhausted`; else the next round, at once or, with `every`, once `round end + every` has come:
     * before that the run PARKS (the engine timer is written, then LangGraph's interrupt checkpoints the thread with no running
     * thread; the timer's wake resumes it and this node runs again from its first line, where the instant has come). A condition that
     * cannot be read stops the loop node for a person (an engine stop).
     */
    private async untilVisited(visit: StepVisit, node: GraphSpecNode, scope: ThreadNodeScope): Promise<ThreadNodeAnswer> {
        const { at, view, input, turn } = visit
        const settings = untilSettingsOf(node.params)
        const targets = untilTargetsOf(at.flow, node)
        const frame = at.until?.nodeKey === node.key ? at.until : null
        if (settings === null)
            return this.troubled(at, view, input, node, turn, troubleOfRefusal(UNTIL_CONDITION_UNREADABLE, `${node.key}: until, max or every`))
        if (frame === null) {
            await this.started(view, input, node)
            return { update: { loop: untilStarted(node.key) }, goto: targets.body }
        }
        // A visit while the round runs (never drawn: every way out of the body ends the round) goes on with the round.
        if (frame.ended === null) return { update: { loop: frame }, goto: targets.body }
        const holds = settings.until.kind === "meaning" ? meaningHolds(frame, settings) : await this.roundHolds(visit, node, frame)
        if (holds === null)
            return this.troubled(at, view, input, node, turn, troubleOfRefusal(UNTIL_CONDITION_UNREADABLE, `${node.key}.until`))
        const judged = untilJudged(frame, settings, holds)
        if (judged.kind !== "again") {
            const goto = judged.kind === "stopped" ? targets.next : targets.exhausted
            return this.completed(at, view, input, node, turn, { output: judged.output, effects: [], route: { goto, loop: null } })
        }
        if (judged.dueAt !== null && Date.parse(judged.dueAt) > this.clock.now().getTime()) {
            const park = untilParkOf(node.key, judged.frame.round, judged.dueAt)
            // The timer first (idempotent: one job per park), then the interrupt: no checkpoint of a park exists without its timer.
            await this.rounds?.armed({ workspaceId: view.workspaceId, runId: view.runId }, park)
            scope.stop(park)
        }
        return { update: { loop: judged.frame }, goto: targets.body }
    }

    /**
     * A visit of a `wait` node (`TEMPLATE_WAIT_STEP`): its triggers are read with the match values the run holds now, and the run PARKS
     * (the deadline job first, idempotent per park, then LangGraph's interrupt, which checkpoints the thread waiting for no person: no
     * stop, no card). The ONE wake of the park (an event the wait took, or the deadline) resumes the thread; this node runs again from its
     * first line, where `scope.stop` answers what came, and completes with `{ trigger: <key>, event }` or `{ trigger: "timeout" }`, routed
     * on `trigger`. Triggers or a timeout that cannot be read stop the node for a person (an engine stop).
     */
    private async waitVisited(
        visit: StepVisit,
        node: GraphSpecNode,
        scope: ThreadNodeScope,
        trigger: StepJson,
    ): Promise<ThreadNodeAnswer> {
        const { at, view, input, turn } = visit
        await this.started(view, input, node)
        const bound = await this.boundOf(at, view, input, node)
        const on = waitOnOf(bound.params.on)
        const timeoutMs = timeoutMsOf(node.params?.timeout)
        if (on === null || timeoutMs === null)
            return this.troubled(at, view, input, node, turn, troubleOfRefusal(WAIT_UNREADABLE, `${node.key}: on or timeout`))
        const park = waitParkOf(view.stepKey, new Date(this.clock.now().getTime() + timeoutMs).toISOString(), on, runSubjectOf(on, trigger))
        // The deadline first (one job per park), then the wait's keys (how an event finds this run by value or subject, exactly), then the
        // interrupt: no checkpoint of a wait exists without its deadline and its keys. Both are idempotent per park; the resumed visit runs
        // this line again and clears the keys once the wait has what came.
        await this.rounds?.armedWait({ workspaceId: view.workspaceId, runId: view.runId }, park)
        await this.agentRuns?.markWait(view.workspaceId, view.runId, waitMatchKeysOf(park))
        // The events held behind this run are offered to this wait first: they drain after this drive gives the lease back.
        await this.handBacks?.offerToWait(view.workspaceId, view.runId)
        const came = waitCameOf(scope.stop<unknown>(park), park.parkKey)
        await this.agentRuns?.markWait(view.workspaceId, view.runId, [])
        if (came === null)
            return this.troubled(at, view, input, node, turn, troubleOfRefusal(WAIT_UNREADABLE, `${node.key}: what came`))
        return this.completed(at, view, input, node, turn, { output: waitOutputOf(came), effects: [] })
    }

    /**
     * A visit of a hand-back node (`TEMPLATE_HAND_BACK_STEP`, params `{ wait: <the wait's node key> }`): the event that wait took in this
     * visit (its output in this round or iteration) is given back (`ThreadHandBacksService.handBack`) and the node completes, so the run
     * goes on to its `next`. A wait that took no event (its timeout, or no visit) cannot be handed back: an engine stop for a person.
     */
    private async handBackVisited(visit: StepVisit, node: GraphSpecNode): Promise<ThreadNodeAnswer> {
        const { at, view, input, turn } = visit
        await this.started(view, input, node)
        const waitKey = node.params?.[HAND_BACK_WAIT_PARAM]
        const wait = typeof waitKey === "string" ? at.flow.nodes.find((one) => one.key === waitKey && one.step === TEMPLATE_WAIT_STEP) : undefined
        // The wait runs in the same round or iteration as its hand-back (the SDK's save check: the hand-back sits on one of its routes).
        const parkKey =
            wait === undefined
                ? null
                : (roundStepKeyOf({ key: wait.key, inLoop: at.step.inLoop }, at.until ?? null) ??
                  loopStepKeyOf(wait.key, at.step.inLoop, at.frame ?? null))
        const taken = parkKey === null ? undefined : view.earlier[parkKey]?.output
        const ref = { workspaceId: view.workspaceId, runId: view.runId, agentId: view.agentId }
        const result = this.handBacks === undefined || wait === undefined ? null : await this.handBacks.handBack(ref, taken, wait.params?.on)
        if (result === null || result.kind === "no_event")
            return this.troubled(at, view, input, node, turn, troubleOfRefusal(HAND_BACK_NO_EVENT, `${node.key}: ${String(waitKey)}`))
        return this.completed(at, view, input, node, turn, { output: { handedBack: true }, effects: [] })
    }

    /** Whether an until loop's DATA condition holds after `frame.round`: its refs resolved in that round's scope; null when unreadable. */
    private async roundHolds(visit: StepVisit, node: GraphSpecNode, frame: UntilFrame): Promise<boolean | null> {
        const { at, view, input } = visit
        try {
            const bound = await this.boundOf(at, view, { ...input, ...roundInputOf(frame) }, node)
            return resolvedConditionHolds(bound.params.until)
        } catch (error: unknown) {
            this.logger?.error(AgentThreadsLogEvent.StepReadFailed, error, { stepKey: view.stepKey, read: "until" })
            return null
        }
    }

    /**
     * What a body step of a `loop({ until })` round writes into the frame: the route the meaning node took, a NODE step's output as the
     * round's `last` (a control step's, an `if`'s `{ branch }` above all, never: R46), and, when the step goes back to the loop node, how
     * the round ended (when, and the round's last node output). Nothing outside a round.
     */
    private roundLeftOf(at: ThreadStepNode, goto: string, output: LoopItem): { readonly loop?: UntilFrame } {
        const frame = at.until ?? null
        if (!inRound(at.step, frame)) return {}
        const loop = at.flow.nodes.find((one) => one.key === frame.nodeKey)
        const settings: UntilSettings | null = loop === undefined ? null : untilSettingsOf(loop.params)
        const left = roundLeft(frame, at.step, settings, { output, toLoop: goto === frame.nodeKey, at: this.clock.now().toISOString() })
        return left === null ? {} : { loop: left }
    }

    /** The loop node's visit after an iteration ended: the next iteration starts, or the loop's output completes the loop node. */
    private looped(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        move: ThreadLoopMove,
    ): Promise<ThreadNodeAnswer> {
        if (move.kind === "iterate") return Promise.resolve({ update: { loop: move.frame }, goto: move.goto })
        return this.completed(at, view, input, node, turn, { output: move.output, effects: [], route: { loop: null } })
    }

    /**
     * The loop node of a fan-out on a visit: nothing while an item of its window runs; the next branches (a window, or the held items
     * back to their failed nodes); the gate once for every held item of the window (the first item's stop is the question, every held
     * step is listed, so the founder's one decision reaches all of them); or the loop's output once every item ran.
     */
    private fanned(
        at: ThreadStepNode,
        view: StepView,
        input: GraphNodeStepInput,
        node: GraphSpecNode,
        turn: NodeTurn,
        move: FanoutMove,
    ): Promise<ThreadNodeAnswer> {
        switch (move.kind) {
            case "wait":
                return Promise.resolve({ sends: [] })
            case "fan":
                return Promise.resolve({ update: { loop: move.frame, branches: move.records, trouble: null }, sends: sendsOf(move) })
            case "gate": {
                const [first] = move.held
                const trouble = first?.trouble ?? {}
                const left = {
                    ...trouble,
                    nodeKey: at.step.key,
                    held: move.held.map((one) => one.stepKey),
                }
                return Promise.resolve({ update: { loop: move.frame, trouble: left }, goto: FREEZE_NODE })
            }
            case "summed":
                return this.completed(at, view, input, node, turn, { output: move.output, effects: [], route: { loop: null, branches: null } })
        }
    }

    /**
     * The engine's gate (`__freeze`): hands the stop's question to `scope.stop` (the thread waits for a person there) and, once a decision
     * resumes the thread, routes it through the stop: back to the step with every word the founder gave, back to itself, or to the end.
     */
    async gate(_at: ThreadGateNode, state: ThreadState, scope: ThreadNodeScope): Promise<ThreadNodeAnswer> {
        const trouble = this.troubleOf(state)
        if (trouble === null) return { goto: THREAD_END }
        const decision = scope.stop<unknown>(trouble.question)
        const ref = { workspaceId: scope.thread.workspaceId, runId: scope.thread.runId }
        const route = await this.stops.decide(ref, trouble.stepKey, decision, FREEZE_NODE, { locale: trouble.locale })
        // A fan-out's window held several items: the one decision is kept on each of their open stops (the same route for all).
        for (const stepKey of trouble.held ?? []) {
            if (stepKey === trouble.stepKey) continue
            const held = await this.stops.stopOf(ref, stepKey)
            if (held?.state === "open") await this.stops.decide(ref, stepKey, decision, FREEZE_NODE, { locale: trouble.locale })
        }
        // A stop of an iteration is keyed `<node>[<i>]`; the thread goes back to the graph node (the frame still names the iteration).
        const goto = route.goto === trouble.stepKey ? (trouble.nodeKey ?? trouble.stepKey) : route.goto
        const by = isRecord(decision) && typeof decision.by === "string" ? decision.by : null
        // A take-over keeps the thread at the gate: the run keeps waiting, marked as held by a person, never `running`.
        if (route.goto === FREEZE_NODE) await this.projection?.takenOver(ref, by)
        else await this.projection?.resumed(ref, { at: this.clock.now() })
        // A skip ends the run here; the speaker goes back in the thread runs' end hook (0-8), never here, so it is released once.
        if (route.goto === THREAD_END)
            await this.projection?.runEnded(ref, { outcome: "skipped", code: "skipped_by_founder", by, at: this.clock.now() })
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
            const trouble = troubleOfThrow(cause)
            // A fault that is no domain error names no code: its stack is the only way to find it, so it goes to the log (never to /chat).
            if (trouble.kind === "threw")
                this.logger?.error(AgentThreadsLogEvent.StepThrew, cause, {
                    runId: view.runId,
                    stepKey: view.stepKey,
                    errorStack: cause instanceof Error ? (cause.stack ?? "").slice(0, STACK_LOG_MAX) : "",
                })
            return { trouble }
        }
    }

    /** The workflow version each pinned graph version is named by (see `namedVersionOf`), kept once it was found: it never changes. */
    private readonly namedVersions = new Map<string, string>()

    /**
     * The version id the step of a run states (its run token, the audit, the shadow tallies, the node rows): ONE kind, the WORKFLOW
     * version. The thread's own pin stays what it is (the engine reads the graph by it); a run a workflow took is NAMED by the workflow
     * version that mirrors the pin, a run of no workflow by its pin (no node row can judge it). Resolved here, where the step is made.
     */
    private async namedVersionOf(workspaceId: string, at: ThreadStepNode): Promise<string> {
        if (at.workflowId === null) return at.versionId
        const kept = this.namedVersions.get(at.versionId)
        if (kept !== undefined) return kept
        const named = await this.graphs.workflowVersionIdOf(workspaceId, at.agentId, at.versionId)
        if (named !== at.versionId) {
            if (this.namedVersions.size >= NAMED_VERSIONS_KEPT) this.namedVersions.clear()
            this.namedVersions.set(at.versionId, named)
        }
        return named
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
        const [beyond] = effectsBeyond(this.nodes.installed().nodes.get(node.step)?.effects ?? [], grant)
        if (beyond !== undefined) return { code: new RightsDeniedError(beyond).code, text: `effect not granted: ${beyond}` }
        const bound = await this.boundOf(at, view, input, node)
        const told = this.policy === undefined ? turn : await this.policy.toldOf(turn, at.flow.moduleKey, `${view.runId}:${view.stepKey}`)
        // One replay per run of the node: the thread's wrapper of the host's ports, and in the same record the model turns of the host's
        // own agent loop (a node the AGENT_LOOP flag names), so a step that starts again asks the model nothing it already answered.
        const replayed = replayRunOf(at.replay)
        // The run after the owner approved carries exactly the approved call's fingerprint (and so does a later run of the step). The
        // engine runs the approved call itself, once, under its own key, and hands the model its answer: the model is never asked to
        // issue it again (D-P11-5: asked again, it rewrote its words and the approval no longer matched).
        // The workflow step every call of this run is made in: the graph node (an iteration runs its node), the pin and its workflow.
        // A run a provider trigger started also states its part for that trigger (decider or notice), which the rights judge reads.
        const triggerRole = triggerRoleIn(input.trigger)
        const step: NodeStepRef = {
            nodeKey: node.key,
            versionId: await this.namedVersionOf(view.workspaceId, at),
            workflowId: at.workflowId,
            ...(triggerRole === undefined ? {} : { triggerRole }),
        }
        const approved = (await this.approvals?.approvedRun(
            { workspaceId: view.workspaceId, runId: view.runId },
            view.stepKey,
            told,
            step,
        )) ?? { approval: null, answer: null }
        const approval = approved.approval
        // The call the engine ran for this step is DONE by the step: its answer is handed to the model, and the tool counts as called
        // (`alreadyDone`), so a node that REQUIRES it can end on that answer instead of being refused for a call it was told not to repeat.
        const runTurn =
            approved.answer === null
                ? told
                : {
                      ...told,
                      founderAnswers: [...(told.founderAnswers ?? []), approved.answer],
                      ...(approved.tool === undefined
                          ? {}
                          : { alreadyDone: [...new Set([...(told.alreadyDone ?? []), approved.tool])] }),
                  }
        try {
            return await this.host.run({
                nodeId: node.step,
                params: bound.params,
                input: bound.input,
                turn: runTurn,
                grant: { tools: grant.tools },
                key: `${view.runId}:${view.stepKey}`,
                step,
                // The model the graph's node names (the shop's choice); absent, the host takes blocks-core's for the step.
                ...(node.model === undefined ? {} : { model: node.model }),
                replay: replayed.replay,
                record: replayed.record,
                ...(approval === null ? {} : { approval }),
                // A person's "no" to an approval of this step, read where approvals live: a template node reads it as `declined`.
                ...(this.approvals === undefined ? {} : { declined: this.declinedIn(view) }),
                // A call asking again for a fingerprint a person approved in this step (the replay of an approved write) runs as
                // approved: its receipt answers it, nothing is asked again.
                ...(this.approvals === undefined ? {} : { approved: this.approvedIn(view) }),
                // Inside a for-each body: the item, which a template node reads as `ctx.run.item`.
                ...(input.item === undefined ? {} : { item: { key: input.item.key, index: input.item.index } }),
            })
        } catch (cause) {
            return ranOfFailure(cause)
        }
    }

    /** The approval a person gave in the step of `view` to the call of a fingerprint, or null (the approvals' own records). */
    private approvedIn(view: StepView): (fingerprint: string) => Promise<NodeToolApproval | null> {
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        return (fingerprint) => this.approvals?.approvedFor(ref, view.stepKey, fingerprint) ?? Promise.resolve(null)
    }

    /** Whether a person declined the approval of the call of a fingerprint in the step of `view` (the approvals' own records). */
    private declinedIn(view: StepView): (fingerprint: string) => Promise<boolean> {
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        return (fingerprint) => this.approvals?.declined(ref, view.stepKey, fingerprint) ?? Promise.resolve(false)
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
        const byEngine = ENGINE_STOP_CODES.has(trouble.code)
        // A side node (`blocking: false`) that fails is passed over: the thread goes on, the founder is told once. An outcome-unknown
        // failure still stops, side node or not: only a person may say whether its effect happened.
        if (node !== undefined && !byEngine && this.passable(node, trouble)) return this.passedOver(at, view, input, node, turn, trouble)
        // A member of the shop holds the run's route (ruling R45): the step's failure (its send refused `route_held`, or anything else the
        // node met while the person is served by staff) is no failure for the founder: no stop card, no lead freeze; the run ends quietly
        // and the hand-back's resume event answers the person. An engine stop or an outcome-unknown step still stops for a person.
        if (!byEngine && !OUTCOME_UNKNOWN.has(trouble.code) && (await this.routeHeld(view, turn)))
            return this.endedUnderHold(view, turn, trouble)
        const given = node === undefined ? null : await this.givenOf(at, view, input, node)
        const subject = this.memory?.subjectOf(view, input) ?? null
        const contactId = subject?.contactId ?? (await this.contactOfConversation(view.workspaceId, turn.conversationId))
        const decision =
            isAiFailure(trouble) || node === undefined || byEngine
                ? null
                : await this.decisionOf({ at, view, input, turn, trouble, given, nodeStep }, subject?.conversationId ?? null)
        // An outcome-unknown step never completes by the AI's output: only the founder decides whether it happened.
        if (decision?.kind === "output" && node !== undefined && !OUTCOME_UNKNOWN.has(trouble.code)) {
            this.notices?.recovered(view, trouble)
            return this.completed(at, view, input, node, turn, {
                output: decision.output,
                effects: [],
                recovered: { by: "ai", code: trouble.code, kind: trouble.kind },
            })
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
        const kind = stopKindOf(byEngine, report !== null)
        const card: StopCardContext = {
            locale: turn.locale === "en" ? "en" : "vi",
            workflow: await this.workflowRefOf(at, view, turn.locale),
            step: { key: view.stepKey, nodeId: nodeStep, title: this.stepTitleOf(nodeStep, turn.locale) ?? view.stepKey },
            by: report === null ? "engine" : "ai",
        }
        const { question, told } = await this.stops.opened({
            workspaceId: view.workspaceId,
            runId: view.runId,
            stepKey: view.stepKey,
            agentId: at.agentId,
            workflowId: at.workflowId,
            contactId,
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
        // One customer line per stop, ever: when this run's step already told the customer for this stop (its own send, which the
        // ledger kept and the stop now holds, or an earlier holding line, with no founder's words since), the engine adds none; the
        // step's line is the one the stop records.
        if (report?.customerLine !== null && report?.customerLine !== undefined && told === null)
            await this.customerLine(at, view, turn, report.customerLine, contactId)
        await this.projection?.stepStopped(
            { workspaceId: view.workspaceId, runId: view.runId },
            { ...this.factOf(view, input, node), code: trouble.code, error: { code: trouble.code, text: trouble.text }, calls: [], waitItemId: null },
        )
        const left: ThreadTrouble = { stepKey: view.stepKey, ...nodeKeyIn(view), question, locale: card.locale }
        return { update: { trouble: { ...left } }, goto: FREEZE_NODE }
    }

    /** True when a member of the shop holds the route of the run's turn now (the engine's staff hold, `customer_routes`). */
    private async routeHeld(view: StepView, turn: NodeTurn): Promise<boolean> {
        if (this.routes === undefined || turn.conversationId === null) return false
        const hold = await this.routes.holdOf(view.workspaceId, turn.conversationId)
        return typeof hold?.memberId === "string"
    }

    /** Ends the run of a step that failed under a staff hold: `skipped` with code `route_held`, logged, nothing told, nothing frozen. */
    private async endedUnderHold(view: StepView, turn: NodeTurn, trouble: StepTrouble): Promise<ThreadNodeAnswer> {
        this.logger?.info(AgentThreadsLogEvent.RouteHeldEnded, {
            runId: view.runId,
            stepKey: view.stepKey,
            code: trouble.code,
            routeId: turn.conversationId ?? "",
        })
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        await this.projection?.runEnded(ref, { outcome: "skipped", code: ROUTE_HELD, by: null, at: this.clock.now() })
        return { goto: THREAD_END }
    }

    /** Whether a failed node is a side node (`blocking: false`) whose failure is passed over: never an outcome-unknown one. */
    private passable(node: GraphSpecNode, trouble: StepTrouble): boolean {
        return !OUTCOME_UNKNOWN.has(trouble.code) && !nodeBlocks(node, installedStepIn(this.nodes.installed().nodes, node.step)?.blocking)
    }

    /** What the AI core makes of a step's trouble: an output, or a report; null without an AI core. */
    private async decisionOf(asked: TroubleAsked, subjectConversationId: string | null): Promise<CoreDecision | null> {
        if (this.core === undefined) return null
        const { at, view, input, turn } = asked
        return this.core.decide({
            turn,
            nodeKey: view.nodeKey,
            stepKey: view.stepKey,
            nodeStep: asked.nodeStep,
            trouble: asked.trouble,
            given: asked.given,
            // The founder's words of this stop ride the trigger as the AI core's instructions read them (`founderAnswers`), so after an
            // answer it does not ask the same thing again.
            trigger:
                turn.founderAnswers === undefined || turn.founderAnswers.length === 0
                    ? input.trigger
                    : { ...input.trigger, founderAnswers: [...turn.founderAnswers] },
            earlier: view.earlier,
            memory: await this.scopeOrNull(at, view, input),
            conversationId: turn.conversationId ?? subjectConversationId,
        })
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
        const contactId =
            this.memory?.subjectOf(view, input)?.contactId ?? (await this.contactOfConversation(view.workspaceId, turn.conversationId))
        const ref = { workspaceId: view.workspaceId, runId: view.runId }
        // The card's words are asked of the judge as this step's (road `approval_card`), so they name the account the ASK was made on.
        const step: NodeStepRef = {
            nodeKey: node.key,
            versionId: await this.namedVersionOf(view.workspaceId, at),
            workflowId: at.workflowId,
        }
        const asked = await this.approvals.asked(
            { ...ref, stepKey: view.stepKey, agentId: at.agentId, workflowId: at.workflowId, contactId, turn: { ...turn, step }, card },
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
        ending: StepEnding,
    ): Promise<ThreadNodeAnswer> {
        const { output, effects, recovered, route = {} } = ending
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
        const branches = route.branches === undefined ? {} : { branches: route.branches }
        // A fan-out's loop node sends its branches instead of going on: its exit follows once the loop is summed.
        if (route.sends !== undefined)
            return {
                update: { steps: { [view.stepKey]: { output: kept } }, trouble: null, loop: route.loop ?? null, ...branches },
                sends: route.sends,
            }
        const goto = route.goto ?? stepExitOf(at.step, output)
        const loop =
            route.loop !== undefined
                ? { loop: route.loop }
                : { ...this.iterationLeft(at, goto, kept, kept), ...this.roundLeftOf(at, goto, kept) }
        return { update: { steps: { [view.stepKey]: { output: kept } }, trouble: null, ...loop, ...branches }, goto }
    }

    /**
     * What a body node's visit writes into the frame of its loop: the `collect` node's output kept for the item (`picked`, a completed
     * visit only: `picked` is its output, null for a node passed over), and, when the node goes back to the loop node, how the iteration
     * ended, for the loop node to join. Nothing for a node outside the running loop.
     */
    private iterationLeft(at: ThreadStepNode, goto: string, output: LoopItem, picked: LoopItem | undefined): LoopPart {
        const frame = at.frame ?? null
        if (frame === null || at.step.inLoop === undefined || frame.nodeKey !== at.step.inLoop) return {}
        const kept = picked === undefined ? frame : iterationPicked(frame, at.step.key, picked)
        if (goto !== at.step.inLoop) return kept === frame ? {} : { loop: kept }
        return { loop: iterationEnded(kept, output) }
    }

    /**
     * The line the AI core chose for the customer, under the holding-line key of the stop, by the agent of the run. It is the engine's own
     * line: it goes through the same send as a node's (the delivery ledger records it, the stop counts it as told) and addresses the
     * person the run serves, on the route the run was woken on.
     */
    private async customerLine(
        at: ThreadStepNode,
        view: StepView,
        turn: NodeTurn,
        text: string,
        contactId: string | null,
    ): Promise<void> {
        const send = this.nodes.optionalExecutorOf(TOOL.customerMessageSend)
        const person = contactId ?? turn.contactId ?? null
        if (send === undefined || (person === null && turn.conversationId === null)) return
        // Once per run and step: the line is kept under this key, so a stop of the same step again sends no second line.
        const key = `${HOLDING_LINE_KEY_PREFIX}${view.runId}:${view.stepKey}`
        try {
            // The line names the step it is sent FOR and the agent of the RUN: it is filed on the engine's own road with that step, and
            // where the workspace's node rights decide, the step's node decides it.
            const step = {
                nodeKey: view.nodeKey,
                versionId: await this.namedVersionOf(view.workspaceId, at),
                workflowId: at.workflowId,
                runAgentId: at.agentId,
            }
            const spoken = { ...turn, step }
            const sent = await send.execute(
                spoken,
                { ...(person === null ? {} : { contactId: person }), text },
                { key, dedupeKey: key },
            )
            // The send refused the line (in either state of the switch: a tick or a node row that does not allow it, a draft that
            // waits for the owner, a person holding the conversation): the customer was told NOTHING, and the stop says so with the
            // reason, never as a line told.
            if (sent.kind === REFUSED_KIND) {
                const reason: unknown = sent.facts?.reason
                await this.stops.lineNotTold(
                    { workspaceId: view.workspaceId, runId: view.runId },
                    view.stepKey,
                    typeof reason === "string" && reason !== "" ? reason : sent.id,
                    { locale: turn.locale === "en" ? "en" : "vi" },
                )
                // The step's node may not message this customer: the team is also told once, in the engine's words; no approval
                // is raised for a holding line.
                if (sent.facts?.rule === NODE_RULE) await this.lineNotSent(at, view, turn, reason)
                return
            }
            const route: unknown = sent.facts?.routeId
            await this.stops.lineSent({ workspaceId: view.workspaceId, runId: view.runId }, view.stepKey, {
                conversationId: typeof route === "string" && route !== "" ? route : (turn.conversationId ?? ""),
                text,
                at: this.clock.now().toISOString(),
            })
        } catch (error: unknown) {
            // A line the channel refuses is not the step's failure: the team already has the card.
            this.logger?.error(AgentThreadsLogEvent.CustomerLineRefused, error, { stepKey: view.stepKey })
        }
    }

    /**
     * Tells the TEAM that the engine's holding line was not sent because the step's node may not message the customer (the
     * workspace's node rights decide): one post per run and step, in the engine's own words, with the workflow, the step and why. The
     * AI core's words for the customer are not repeated: nothing is composed for the customer.
     */
    private async lineNotSent(at: ThreadStepNode, view: StepView, turn: NodeTurn, reason: unknown): Promise<void> {
        const post = this.nodes.optionalExecutorOf(TOOL.teamMessagePost)
        if (post === undefined) return
        const workflow = await this.workflowRefOf(at, view, turn.locale)
        const why = this.catalog.get(LINE_NOT_SENT_WORDS[typeof reason === "string" ? reason : ""] ?? LINE_NOT_SENT_OFF, {}, turn.locale)
        const facts: ReadonlyArray<readonly [string, string]> = [
            ["workflow", workflow.title],
            ["step", view.stepKey],
            ["reason", why],
            ["run", view.runId],
        ]
        const key = `line-not-sent:${view.runId}:${view.stepKey}`
        await post.execute(
            turn,
            {
                kind: "message.text",
                intent: "notify",
                audience: "founder",
                title: this.catalog.get("agentGraphs.customerLineNotSent.title", {}, turn.locale),
                text: facts.map(([name, value]) => `- ${name}: ${value}`).join(LINE_BREAK),
            },
            { key, dedupeKey: key },
        )
    }

    /** The step began a try: its projection row. */
    private async started(view: StepView, input: GraphNodeStepInput, node: GraphSpecNode | undefined): Promise<void> {
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
            stepKey: roundStepKeyOf(at.step, at.until ?? null) ?? loopStepKeyOf(at.step.key, at.step.inLoop, at.frame ?? null),
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
            // The generic trigger scope names the person's route `routeId` (the engine's `conversationId` of the turn); no chat member.
            conversationId: textOf(trigger, "routeId"),
            contactId: textOf(trigger, "contactId"),
            locale: localeOf(trigger),
            origin: trigger.origin === "channel" ? "customer" : "system",
            memberId: textOf(trigger, "actorMemberId"),
            handedOffBy: handedOffByOf(trigger),
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
        } catch (error: unknown) {
            this.logger?.error(AgentThreadsLogEvent.StepReadFailed, error, { stepKey: view.stepKey, read: "given" })
            return null
        }
    }

    private async scopeOrNull(at: ThreadStepNode, view: StepView, input: GraphNodeStepInput): Promise<unknown> {
        try {
            return (await this.memory?.scopeOf(view, at.flow, input))?.memory ?? null
        } catch (error: unknown) {
            this.logger?.error(AgentThreadsLogEvent.StepReadFailed, error, { stepKey: view.stepKey, read: "memory" })
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
            .catch((error: unknown) => {
                this.logger?.error(AgentThreadsLogEvent.StepReadFailed, error, { stepKey: view.stepKey, read: "workflow_name" })
                return ""
            })
        if (own !== undefined && own !== "") return { moduleKey, key, title: own }
        const template = INSTALLED.templateOf(`${moduleKey}.${key}`)
        if (template !== null) return { moduleKey, key, title: localeText(template.name, locale) }
        return { moduleKey, key, title: key === "" ? moduleKey : key }
    }

    /** The contact of the run's conversation (its channel identity's), when the run's memory names none. */
    private async contactOfConversation(workspaceId: string, conversationId: string | null): Promise<string | null> {
        if (conversationId === null || this.contacts === undefined) return null
        try {
            return await this.contacts.contactOf(workspaceId, conversationId)
        } catch (error: unknown) {
            this.logger?.error(AgentThreadsLogEvent.StepReadFailed, error, { conversationId, read: "contact" })
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
        const left = { ...this.iterationLeft(at, goto, null, undefined), ...this.roundLeftOf(at, goto, null) }
        return { update: { steps: { [view.stepKey]: { ...result } }, trouble: null, ...left }, goto }
    }

    /** The title of an installed step (a template node or a `defineNode` node) in the team's language, or null. */
    private stepTitleOf(nodeId: string, locale: NodeTurn["locale"]): string | null {
        const title = installedStepIn(this.nodes.installed().nodes, nodeId)?.title
        if (title === undefined) return null
        if ("key" in title) return this.catalog.get(title.key, {}, locale)
        return localeText(title, locale)
    }

    /** The trouble a step left for the gate, or null when the state holds none it can read. */
    private troubleOf(state: ThreadState): ThreadTrouble | null {
        const trouble = state.trouble
        if (!isRecord(trouble)) return null
        const { stepKey, nodeKey, question, locale, held } = trouble
        if (typeof stepKey !== "string" || !isRecord(question)) return null
        const heldSteps = Array.isArray(held) ? held.filter((one: unknown): one is string => typeof one === "string") : []
        return {
            stepKey,
            ...(typeof nodeKey === "string" ? { nodeKey } : {}),
            question: question as unknown as StopQuestion,
            locale: locale === "en" ? "en" : "vi",
            ...(heldSteps.length === 0 ? {} : { held: heldSteps }),
        }
    }
}
