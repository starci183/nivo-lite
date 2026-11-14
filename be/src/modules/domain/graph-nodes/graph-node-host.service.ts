import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { z } from "zod"
import {
    NodeRunError,
    effectAnswerOf,
    guidedModelRequest,
    runNode,
    runTemplateNode,
    type EffectPayload,
    type NodeAgentLoop,
    type NodeHostPorts,
    type NodeIndex,
    type NodeModelRequest,
    type NodeRun,
    type SubjectRef,
    type ToolDefinition,
} from "@nivo-lite/agent-sdk/node"
import type { ToolId } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { AnyTemplateNode, DeclinedRefusal, WorkspaceFacts } from "@nivo-lite/agent-sdk/template"
import { INSTALLED, TEMPLATE_IF_STEP, installedStepIn } from "@modules/domain/installed-plugins"
import { withPicturesNotSeen } from "@modules/domain/chat-files"
// The service file itself, not the door's index: the door's module reaches the agent graphs, which reach this host.
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { DEFAULT_TIME_ZONE } from "@nivo-lite/agent-sdk/port"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { coreModelOf, declaredModelOf, declaredWorkOf } from "./node-model.policy"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import type { NodeAnswerSchema } from "./graph-node-host.schema"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import {
    InjectGraphNodeAgentLoops,
    InjectGraphNodeModel,
    InjectGraphNodeToolDoor,
    InjectGraphNodesOptions,
} from "./graph-nodes.decorators"
import type {
    NodeAgentLoops,
    NodeModelDoor,
    NodeModelScope,
    NodeRunInput,
    NodeSubjectResolver,
    NodeToolAnswer,
    NodeToolDoor,
    NodeTurn,
    NodeTurnRecord,
} from "./graph-nodes.contracts"
import type { GraphNodesOptions } from "./graph-nodes.options"
import type { NodeStepRef, NodeToolApproval } from "./node-run-token.contracts"
import { withWorkScope } from "@modules/platform/logging"
import { nodeWorkOf } from "./node-work.policy"
import { conditionBranchOf } from "./template-condition.policy"
import { runDayOf, runIdOfKey, runItemOf, splitTemplateBindings } from "./template-run.policy"

/** The ledger entry that holds a template node's run step instant (`ctx.run.at`): written once per run step, read on every re-run. */
const STEP_INSTANT = "engine.step-instant"

/** The ledger entry that holds a template node's run step day (`ctx.run.day`): fixed with the instant, so a re-run never moves it. */
const STEP_DAY = "engine.step-day"

/** The refusal of an `AGENT_LOOP` flag the app cannot honour, naming what is wrong. */
const flagInvalid = (name: string): GraphNodesError =>
    new GraphNodesError({ code: GraphNodesErrorCode.AgentLoopFlagInvalid, params: { name } })

/** The tool the door is handed for an id no plugin defines (a gateway native, a source's operation): the door reads only its id. */
const toolOfId = (id: ToolId): ToolDefinition => ({
    entry: "tool",
    id,
    title: { vi: id, en: id },
    args: z.record(z.string(), z.unknown()),
    result: z.unknown(),
    mutates: true,
})

/** The refusal a template node reads for a call a person declined (the universal member of every tool's refusals). */
const DECLINED: DeclinedRefusal = "declined"

/**
 * The template road of a run's ports: every tool call asks for its business refusals as answers (`refusals: "answer"`), and a call
 * that asks again for an approval a person declined is answered `declined` instead of asking.
 */
interface TemplateRoad {
    /** Whether a person declined the approval of the call of this fingerprint in this step. */
    readonly declined: (fingerprint: string) => Promise<boolean>
}

/** What decides an ask of a door call: the template road (when the node runs on it) and the approvals a person already gave in the step. */
interface AskDecisions {
    readonly road: TemplateRoad | undefined
    readonly approved: ApprovedOf
}

/** What the ports of one node turn are built from: the approval it carries, the asks it collects, its attempt, step and decisions. */
interface PortsContext {
    readonly approval: NodeToolApproval | null
    readonly asks: Array<GraphNodesError>
    readonly attempt: Attempt
    readonly step: NodeStepRef | undefined
    readonly approved: ApprovedOf
    readonly road?: TemplateRoad
}

/** A call a person declined, on its way from the ports to `templateCall` (never past it): the node reads it as `declined`. */
class DeclinedCall extends Error {
    constructor(readonly tool: string) {
        super(DECLINED)
    }
}

/** Nothing is ever declined: the template road of a run the engine names no decisions for. */
const NONE_DECLINED = (): Promise<boolean> => Promise.resolve(false)

/** The approval a person gave in this step to the call of a fingerprint, or null. */
type ApprovedOf = (fingerprint: string) => Promise<NodeToolApproval | null>

/** Nothing was ever approved: a run the engine names no approvals for. */
const NONE_APPROVED: ApprovedOf = () => Promise.resolve(null)

/** The fingerprint an approval ask carries, or null for any other error. */
const askedFingerprintOf = (cause: unknown): string | null => {
    if (!(cause instanceof GraphNodesError) || cause.code !== GraphNodesErrorCode.ToolApprovalRequired) return null
    const { fingerprint } = cause.params
    return typeof fingerprint === "string" && fingerprint !== "" ? fingerprint : null
}

/** One attempt of a run step: the step's key, and when this attempt began. */
interface Attempt {
    /** The run step's key (`<run>:<step>`). */
    readonly step: string
    /** When the attempt began (ISO text). */
    readonly startedAt: string
}

@Injectable()
/**
 * Runs one installed node for a turn. The SDK's runner does every check (schemas, declared effects and tools, the tools the run's
 * grant names); this host only binds the ports: the data port each module registered, the executor of each
 * effect behind the once-per-key ledger, the NIVO MCP door for tools, and the agents' metered model path. An engine that replays a
 * step (a thread engine) passes `replay`, which wraps these ports; with none the node runs on them as they are. A node the
 * `AGENT_LOOP` flag names gets the `agent` port too: the host's own loop then takes its agent's turns instead of the runner's JSON loop.
 */
export class GraphNodeHostService implements OnModuleInit {
    constructor(
        private readonly registry: GraphNodeRegistryService,
        private readonly effects: GraphNodeEffectsService,
        @InjectClock() private readonly clock: Clock,
        @InjectGraphNodeModel() private readonly ai: NodeModelDoor,
        @Optional() @InjectGraphNodeToolDoor() private readonly door: NodeToolDoor | null = null,
        @Optional() private readonly tokens?: GraphNodeRunTokensService,
        @Optional() @InjectGraphNodesOptions() private readonly options?: GraphNodesOptions,
        @Optional() @InjectGraphNodeAgentLoops() private readonly agentLoops?: NodeAgentLoops,
        @Optional() private readonly zones?: WorkspaceTimeZoneService,
    ) {}

    /**
     * Refuses to start half switched: every node the `AGENT_LOOP` flag names must be an installed step (a template node or a `defineNode`
     * node, read through the one installed-step view), and naming any needs the loop and the model's agent turns bound. With the flag
     * unset nothing is checked and every agent runs the runner's JSON loop.
     */
    onModuleInit(): void {
        const named = this.options?.agentLoop?.nodes ?? []
        const { nodes } = this.registry.installed()
        const missing = named.find((id) => installedStepIn(nodes, id) === null)
        if (missing !== undefined) throw flagInvalid(missing)
        if (named.length > 0 && (this.agentLoops === undefined || this.ai.nodeAgentTurns === undefined)) {
            throw flagInvalid("no agent loop is bound in this app")
        }
    }

    /**
     * Runs the node and answers its parsed output and the effects it ran. A tool call that waits for a person's approval stops the node
     * whatever the node does with the refusal: a node that catches its tool's failures (to file a connect item, to take a skip branch)
     * cannot swallow the ask, and no write or effect runs after it, so the step always waits for the person instead of acting on a refusal
     * it misread.
     */
    async run(input: NodeRunInput): Promise<NodeRun> {
        // Two forms run in one install while the nodes are converted: the engine's own `if` of a @2 graph, a template node
        // (`defineTemplateNode`, chosen by the definition's `entry`), and the `defineNode` node below.
        if (input.nodeId === TEMPLATE_IF_STEP) return { output: conditionBranchOf(input.params), effects: [] }
        const template = INSTALLED.templateNodeOf(input.nodeId)
        if (template?.entry === "template-node") return this.runTemplate(template, input)
        const installed = this.registry.installed()
        const node = this.registry.nodeOf(input.nodeId)
        const turn = await this.withSubject(input.turn)
        const asks: Array<GraphNodesError> = []
        const attempt: Attempt = { step: input.key, startedAt: this.clock.now().toISOString() }
        // The model of every AI call of this node: the graph's node's own, else blocks-core's for its step, else the default.
        const scope: NodeModelScope = {
            workspaceId: turn.workspaceId,
            locale: turn.locale,
            model: declaredModelOf(input.nodeId, input.model),
        }
        const own = this.portsOf(turn, scope, {
            approval: input.approval ?? null,
            asks,
            attempt,
            step: input.step,
            approved: input.approved ?? NONE_APPROVED,
        })
        const ports = this.takesTurns(input.nodeId) ? { ...own, agent: this.agentOf(scope, input.record) } : own
        // Every model call of the node is booked to its step and agent (owner: "the model and the credits on every node"); a step blocks-core
        // declares a chat turn is booked as one, to the message it answers.
        const work = nodeWorkOf(input.key, turn.agentId, declaredWorkOf(input.nodeId), input.input)
        const ran = await withWorkScope(work, () =>
            runNode(
                {
                    node,
                    params: input.params,
                    input: input.input,
                    turn,
                    grant: input.grant,
                    effects: installed.effects,
                    words: (key) => this.registry.wordsOf(key),
                    tools: installed.tools,
                    key: input.key,
                },
                input.replay === undefined ? ports : input.replay(ports),
            ),
        ).catch((cause: unknown) => {
            throw asks[0] ?? cause
        })
        const [ask] = asks
        if (ask !== undefined) throw ask
        return ran
    }

    /**
     * Runs one template node (contract C1/C4): the SDK's `runTemplateNode` over the host's own ports (the same model door, agent loop,
     * replay wrapper, approvals and run tokens a `defineNode` node gets). Its bindings are split by its two schemas; `ctx.run.at` is the
     * run step's instant, kept in the ledger at the first attempt so every re-run reads the same one; every call is a tool call, made by
     * `templateCall`. A call that waits for a person's approval stops the node whatever it does with the refusal.
     */
    private async runTemplate(node: AnyTemplateNode, input: NodeRunInput): Promise<NodeRun> {
        const installed = this.registry.installed()
        const turn = await this.withSubject(input.turn)
        const asks: Array<GraphNodesError> = []
        const attempt: Attempt = { step: input.key, startedAt: this.clock.now().toISOString() }
        const scope: NodeModelScope = {
            workspaceId: turn.workspaceId,
            locale: turn.locale,
            model: declaredModelOf(input.nodeId, input.model ?? node.model),
        }
        const road: TemplateRoad = { declined: input.declined ?? NONE_DECLINED }
        const own = this.portsOf(turn, scope, {
            approval: input.approval ?? null,
            asks,
            attempt,
            step: input.step,
            approved: input.approved ?? NONE_APPROVED,
            road,
        })
        const withAgent = this.takesTurns(input.nodeId) ? { ...own, agent: this.agentOf(scope, input.record) } : own
        const ports = input.replay === undefined ? withAgent : input.replay(withAgent)
        const bound = splitTemplateBindings(node, input.params, input.input)
        const at = await this.stepInstantOf(turn.workspaceId, input.key)
        const day = await this.stepDayOf(turn.workspaceId, input.key, at)
        const workspace = await this.workspaceOf(turn.workspaceId)
        const work = nodeWorkOf(input.key, turn.agentId, declaredWorkOf(input.nodeId), bound.input)
        const ran = await withWorkScope(work, () =>
            runTemplateNode(
                {
                    node,
                    params: bound.params,
                    input: bound.input,
                    turn,
                    run: { id: runIdOfKey(input.key), at, day, item: runItemOf(input.item), queue: turn.queue ?? [], waiting: turn.waiting ?? 0 },
                    workspace,
                    key: input.key,
                    tools: installed.tools,
                    effects: installed.effects,
                    words: (key) => this.registry.wordsOf(key),
                },
                {
                    callTool: (id, args, key) => this.templateCall(ports, installed, asks, id, args, key),
                    model: ports.model,
                    now: ports.now,
                    ...(ports.agent === undefined ? {} : { agent: ports.agent }),
                },
            ),
        ).catch((cause: unknown) => {
            throw asks[0] ?? cause
        })
        const [ask] = asks
        if (ask !== undefined) throw ask
        return ran
    }

    /**
     * ONE call of a template node, the only place its calls leave the host: an installed effect id through the host's effect road (the
     * runner, or the ledger, the repeat guard and its executor), any other id through the tool road (the runner, or the door). Both are
     * the host's own ports, as the replay wrapper wraps them, so the call is recorded, keyed and approved exactly as a `defineNode`
     * node's call of the same id and arguments. A business refusal comes back as the refusal fact (`refusals: "answer"`); a call a
     * person declined answers the refusal `declined` (a business answer the node goes on from). Neither reaches the effect ledger.
     * An effect's answer reaches the node as `effectAnswerOf` makes it (its facts as `value`, the record in `meta.subject`), from
     * what the effect road answered: the replay wrapper and the ledger keep that subject, so a re-run hands the same value and meta.
     */
    private templateCall(
        ports: NodeHostPorts,
        installed: NodeIndex,
        asks: ReadonlyArray<GraphNodesError>,
        id: ToolId,
        args: JsonObject,
        key: string,
    ): Promise<unknown> {
        if (asks[0] !== undefined) return Promise.reject(asks[0])
        return this.calledOnce(ports, installed, id, args, key).catch((cause: unknown) => {
            if (!(cause instanceof DeclinedCall)) throw cause
            return { ok: false, refusal: DECLINED, facts: { tool: cause.tool } }
        })
    }

    /** The call of `templateCall`: an installed effect on the effect road, any other id on the tool road. */
    private calledOnce(ports: NodeHostPorts, installed: NodeIndex, id: ToolId, args: JsonObject, key: string): Promise<unknown> {
        const effect = installed.effects.get(id)
        if (effect !== undefined) {
            const payload = (effect.codePayload ?? effect.payload).safeParse(args)
            const data: unknown = payload.success ? payload.data : null
            if (typeof data !== "object" || data === null || Array.isArray(data))
                return Promise.reject(new NodeRunError("EFFECT_PAYLOAD_INVALID", id))
            return ports.execute(effect, Object.fromEntries(Object.entries(data)), { key, dedupeKey: null }).then(effectAnswerOf)
        }
        return ports.callTool(installed.tools.get(id) ?? toolOfId(id), args, key)
    }

    /** The run step's instant: the first attempt's clock, kept in the ledger under the step's key, so every re-run reads the same instant. */
    private async stepInstantOf(workspaceId: string, key: string): Promise<string> {
        const now = this.clock.now().toISOString()
        const kept = await this.effects.once(workspaceId, STEP_INSTANT, { key: `${key}:at`, dedupeKey: null }, () =>
            Promise.resolve({ kind: "instant", id: now }),
        )
        return kept.id
    }

    /**
     * The run step's day in the workspace's time zone (the declared setting `timeZone`, the default until one is saved), from its fixed
     * instant, kept in the ledger beside it so a re-run after the owner changed the zone still reads the same day.
     */
    private async stepDayOf(workspaceId: string, key: string, at: string): Promise<string> {
        const kept = await this.effects.once(workspaceId, STEP_DAY, { key: `${key}:day`, dedupeKey: null }, async () => ({
            kind: "day",
            id: runDayOf(at, (await this.zones?.timeZoneOf(workspaceId)) ?? DEFAULT_TIME_ZONE),
        }))
        return kept.id
    }

    /**
     * The workspace's own facts a template node reads (`ctx.workspace`), from its stored settings; in an app that reads no settings, the
     * default zone and no name.
     */
    private async workspaceOf(workspaceId: string): Promise<WorkspaceFacts> {
        return (await this.zones?.factsOf(workspaceId)) ?? { timeZone: DEFAULT_TIME_ZONE, name: "" }
    }

    /** The turn with its subject: the trigger's own, else the first a module's resolver knows, else none. */
    private withSubject(turn: NodeTurn): Promise<NodeTurn> {
        if (turn.subject !== null) return Promise.resolve(turn)
        return this.firstSubject(turn, this.registry.subjectResolvers())
    }

    /**
     * A structured answer of the model for the engine itself (the AI core's one decision on a step that could not complete), on the
     * same metered path as a node's calls and parsed by the schema, under the policy of the turn's agent like every call of that agent
     * (the agent's craft, its tool set and the shop's values go in front of the instructions, in the order every call of the agent
     * has them, so the call shares their cached prefix). It reads and decides only: no port, effect or tool is reachable from
     * it, so nothing it answers acts on the world. `stepKey` is the run step it decides on, which its call is booked to.
     */
    async core<T>(turn: NodeTurn, ask: NodeModelRequest, schema: NodeAnswerSchema<T>, stepKey?: string): Promise<T> {
        const scope: NodeModelScope = { workspaceId: turn.workspaceId, locale: turn.locale, model: coreModelOf() }
        const { effects, tools } = this.registry.installed()
        // Booked to the run step it decides on (`stepKey`), so the run page lists it under that step, never as a call of no step.
        const work = { kind: "engine_core", agentId: turn.agentId, ...(stepKey === undefined ? {} : { stepKey }) }
        const answer = await withWorkScope(work, () =>
            this.ai.nodeJson(
                scope,
                guidedModelRequest({ turn, effects, tools, words: (key) => this.registry.wordsOf(key) }, ask),
                schema,
            ),
        )
        return schema.parse(answer)
    }

    /** The turn with the subject of the first resolver that knows one, asked one after the other; the turn as it was when none does. */
    private async firstSubject(turn: NodeTurn, resolvers: ReadonlyArray<NodeSubjectResolver>): Promise<NodeTurn> {
        const [first, ...rest] = resolvers
        if (first === undefined) return turn
        const subject = await first.subjectOf(turn)
        return subject === null ? this.firstSubject(turn, rest) : { ...turn, subject }
    }

    /**
     * The refusal an effect answers instead of running, when it is a right on a connected provider the run's agent does not hold; null
     * when it may run. A right that asks a person first stops the node like a tool that waits for approval: the ask is kept, so no
     * later write or effect runs, and the step waits for the person. Nothing of a refused or waiting effect reaches the ledger.
     */
    private async effectRefusal(
        turn: NodeTurn,
        effect: string,
        payload: EffectPayload,
        approval: NodeToolApproval | null,
        asks: Array<GraphNodesError>,
        step: NodeStepRef | undefined,
        road: TemplateRoad | undefined,
    ): Promise<SubjectRef | null> {
        if (this.door?.effectRight === undefined) return null
        const { effectRight } = this.door
        const call = {
            token: this.tokenOf(turn, step),
            effect,
            payload,
            approval,
            ...(road === undefined ? {} : { refusals: "answer" as const }),
        }
        const judged = async (): Promise<SubjectRef | null> => (await effectRight.call(this.door, call)) ?? null
        return this.asked(judged(), asks, effect, { road, approved: NONE_APPROVED })
    }

    /** The run token of one call of the turn, signed with the workflow step when the engine named one; empty when no tokens are bound. */
    private tokenOf(turn: NodeTurn, step: NodeStepRef | undefined): string {
        if (this.tokens === undefined) return ""
        return step === undefined ? this.tokens.mint(turn) : this.tokens.mint(turn, step)
    }

    /** True for a node the `AGENT_LOOP` flag names, in an app where the loop is bound: its agent's turns are the host's loop's. */
    private takesTurns(nodeId: string): boolean {
        return this.agentLoops !== undefined && (this.options?.agentLoop?.nodes ?? []).includes(nodeId)
    }

    /**
     * The `agent` port of a flagged node: the host's own loop (native tool calling) takes the model's turns, on the model object the
     * model door makes for the step, with the step's pictures already inlined and each model turn kept by `record` when the engine
     * gave one. Everything a turn DOES still goes through the runner's closures of `loop` (`call`, `done`, `confused`), so the door,
     * the rights per connected account, the send guard and the effect ledger are exactly those of the JSON loop.
     */
    private agentOf(scope: NodeModelScope, record: NodeTurnRecord | undefined): NonNullable<NodeHostPorts["agent"]> {
        return async (loop) => {
            const { agentLoops, ai } = this
            if (agentLoops === undefined || ai.nodeAgentTurns === undefined)
                throw flagInvalid("no agent loop is bound in this app")
            const shown = await this.shownOf(scope, loop)
            const model: unknown = ai.nodeAgentTurns(scope, {
                purpose: loop.purpose,
                ...(loop.reasoning === undefined ? {} : { reasoning: loop.reasoning }),
            })
            return agentLoops.run(shown, model, record === undefined ? {} : { record })
        }
    }

    /**
     * The loop with its pictures as inlined data addresses; a loop with none is handed on as it is. A picture that could not be read is
     * told to the agent as a fact of its input (`picturesNotSeen`, D-MX-4), so it never claims to have seen it.
     */
    private async shownOf(scope: NodeModelScope, loop: NodeAgentLoop): Promise<NodeAgentLoop> {
        if (loop.images === undefined || loop.images.length === 0) return loop
        if (this.ai.nodeImages === undefined) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind: "agent-images" } })
        }
        const images = await this.ai.nodeImages(scope, loop.images)
        return { ...loop, images, input: withPicturesNotSeen(loop.input, loop.images.length - images.length) }
    }

    /**
     * The answer of a door call; an ask for a person's approval is kept, so the node stops for it whatever it does with the throw. On
     * the template road an ask for an approval a person already DECLINED in this step is no ask: it is the call's `declined` answer
     * (`DeclinedCall`, answered by `templateCall`), and nothing waits. An ask for a fingerprint a person already APPROVED in this step
     * (the replay of an approved write) is no ask either: the call runs again once, carrying that approval (`again`), and the write's
     * receipt answers it (it never executes twice). Changed arguments are another fingerprint: they ask, on a new card.
     */
    private asked<T>(
        answer: Promise<T>,
        asks: Array<GraphNodesError>,
        tool: string,
        decisions: AskDecisions,
        again?: (approval: NodeToolApproval) => Promise<T>,
    ): Promise<T> {
        const { road } = decisions
        const kept = (cause: unknown): never => {
            if (cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired) asks.push(cause)
            throw cause
        }
        return answer.catch(async (cause: unknown) => {
            const fingerprint = askedFingerprintOf(cause)
            if (fingerprint === null) return kept(cause)
            if (road !== undefined && (await road.declined(fingerprint))) throw new DeclinedCall(tool)
            const approval = again === undefined ? null : await decisions.approved(fingerprint)
            if (again === undefined || approval?.fingerprint !== fingerprint) return kept(cause)
            return again(approval).catch(kept)
        })
    }

    private portsOf(turn: NodeTurn, scope: NodeModelScope, context: PortsContext): NodeHostPorts {
        const { approval, asks, attempt, step, approved, road } = context
        const decisions = { road, approved }
        // The turn an effect's executor is handed names the workflow step (the node and its model keep the turn as it was).
        const acting: NodeTurn = step === undefined ? turn : { ...turn, step }
        return {
            read: (kind, query, rightScope) => this.registry.portOf(kind).read(turn, query, rightScope),
            write: (kind, record) => {
                if (asks[0] !== undefined) throw asks[0]
                const port = this.registry.portOf(kind)
                if (port.write === undefined)
                    throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind } })
                return port.write(turn, record)
            },
            execute: async (effect, payload, call) => {
                if (asks[0] !== undefined) throw asks[0]
                const { door } = this
                if (door?.run !== undefined) {
                    // On the template road a refusal of the right freezes the step (only business refusals are answered).
                    const run = {
                        road: "effect" as const,
                        token: this.tokenOf(turn, step),
                        effect: effect.id,
                        payload,
                        call,
                        ...(road === undefined ? {} : { refusals: "answer" as const }),
                    }
                    // Bound to the door: its runner is read through `this` (a detached method threw "reading 'runner'").
                    const runOne = door.run.bind(door)
                    const answer = await this.asked(
                        runOne({ ...run, approval, turn, workflowStep: step, attempt }),
                        asks,
                        effect.id,
                        decisions,
                        (given) => runOne({ ...run, approval: given, turn, workflowStep: step, attempt }),
                    )
                    if (answer.road === "effect") return answer.subject
                    throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind: "tool-runner" } })
                }
                const refused = await this.effectRefusal(turn, effect.id, payload, approval, asks, step, road)
                if (refused !== null) return refused
                const executor = this.registry.executorOf(effect.id)
                // Inside the ledger's act: a call the step already made is replayed as it was; only a call that would act for real
                // is asked whether it repeats an earlier attempt. A refusal is an answer the ledger never keeps.
                return this.effects.once(
                    turn.workspaceId,
                    effect.id,
                    call,
                    () => executor.execute(acting, payload, call),
                    // The ledger keeps what the effect was asked, so a later step can read what this one already did (the send guard).
                    { args: payload },
                )
            },
            callTool: (tool, args, key) => {
                if (this.door === null) {
                    throw new GraphNodesError({ code: GraphNodesErrorCode.ToolDoorMissing, params: { tool: tool.id } })
                }
                // On the template road a business refusal comes back as the refusal fact (the node's `ok: false`), never thrown.
                const call = {
                    token: this.tokenOf(turn, step),
                    tool: tool.id,
                    args,
                    key,
                    approval,
                    ...(road === undefined ? {} : { refusals: "answer" as const }),
                }
                const { door } = this
                if (door.run === undefined)
                    return this.asked(door.call(call), asks, tool.id, decisions, (given) => door.call({ ...call, approval: given }))
                // Bound to the door: its runner is read through `this` (a detached method threw "reading 'runner'" on the live retry).
                const run = door.run.bind(door)
                const ran = run({ road: "tool", ...call, turn, workflowStep: step })
                const again = (given: NodeToolApproval): Promise<NodeToolAnswer> =>
                    run({ road: "tool", ...call, approval: given, turn, workflowStep: step })
                return this.asked(ran, asks, tool.id, decisions, again).then((answer) => {
                    if (answer.road === "tool") return answer.value
                    throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind: "tool-runner" } })
                })
            },
            model: {
                text: (ask) => this.ai.nodeText(scope, ask),
                json: async (schema, ask) => schema.parse(await this.ai.nodeJson(scope, ask, schema)),
            },
            now: () => this.clock.now(),
        }
    }
}
