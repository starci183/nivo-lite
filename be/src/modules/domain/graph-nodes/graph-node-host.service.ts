import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { ZodType } from "zod"
import { guidedModelRequest, runNode } from "@nivo-lite/agent-sdk/node"
import type {
    EffectPayload,
    NodeAgentLoop,
    NodeHostPorts,
    NodeModelRequest,
    NodeRun,
    SubjectRef,
} from "@nivo-lite/agent-sdk/node"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { coreModelOf, declaredModelOf } from "./node-model.policy"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
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
    NodeToolDoor,
    NodeTurn,
    NodeTurnRecord,
} from "./graph-nodes.contracts"
import type { GraphNodesOptions } from "./graph-nodes.options"
import type { NodeToolApproval } from "./node-run-token.contracts"
import { withWorkScope } from "@modules/platform/logging"
import { nodeWorkOf } from "./node-work.policy"

/** The refusal of an `AGENT_LOOP` flag the app cannot honour, naming what is wrong. */
const flagInvalid = (name: string): GraphNodesError =>
    new GraphNodesError({ code: GraphNodesErrorCode.AgentLoopFlagInvalid, params: { name } })

/** One attempt of a run step: the step's key, and when this attempt began. */
interface Attempt {
    /** The run step's key (`<run>:<step>`). */
    readonly step: string
    /** When the attempt began (ISO text). */
    readonly startedAt: string
}

@Injectable()
/**
 * Runs one installed node for a turn. The SDK's runner does every check (schemas, the node's declared rights against the agent's
 * grant, declared effects and tools); this host only binds the ports: the data port each module registered, the executor of each
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
    ) {}

    /**
     * Refuses to start half switched: every node the `AGENT_LOOP` flag names must be installed, and naming any needs the loop and the
     * model's agent turns bound. With the flag unset nothing is checked and every agent runs the runner's JSON loop.
     */
    onModuleInit(): void {
        const named = this.options?.agentLoop?.nodes ?? []
        const { nodes } = this.registry.installed()
        const missing = named.find((id) => !nodes.has(id))
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
        const own = this.portsOf(turn, scope, input.approval ?? null, asks, attempt)
        const ports = this.takesTurns(input.nodeId) ? { ...own, agent: this.agentOf(scope, input.record) } : own
        // Every model call of the node is booked to its step and agent (owner: "model, số credits trên từng node").
        const ran = await withWorkScope(nodeWorkOf(input.key, turn.agentId), () =>
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
        ).catch((cause: unknown) => Promise.reject(asks[0] ?? cause))
        const [ask] = asks
        if (ask !== undefined) throw ask
        return ran
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
     * it, so nothing it answers acts on the world.
     */
    async core<T>(turn: NodeTurn, ask: NodeModelRequest, schema: ZodType<T>): Promise<T> {
        const scope: NodeModelScope = { workspaceId: turn.workspaceId, locale: turn.locale, model: coreModelOf() }
        const { effects, tools } = this.registry.installed()
        const answer = await withWorkScope({ kind: "engine_core", agentId: turn.agentId }, () =>
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
    ): Promise<SubjectRef | null> {
        if (this.door?.effectRight === undefined) return null
        const call = { token: this.tokens?.mint(turn) ?? "", effect, payload, approval }
        try {
            return (await this.door.effectRight(call)) ?? null
        } catch (cause) {
            if (cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired)
                asks.push(cause)
            throw cause
        }
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

    /** The loop with its pictures as inlined data addresses; a loop with none is handed on as it is. */
    private async shownOf(scope: NodeModelScope, loop: NodeAgentLoop): Promise<NodeAgentLoop> {
        if (loop.images === undefined || loop.images.length === 0) return loop
        if (this.ai.nodeImages === undefined) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind: "agent-images" } })
        }
        return { ...loop, images: await this.ai.nodeImages(scope, loop.images) }
    }

    /**
     * The refusal an effect answers instead of acting because it would repeat what this step already did in an earlier attempt (the
     * door's repeat guard: one line to a customer per stop); null when it may act, or when no door guards repeats.
     */
    private async repeatRefusal(
        turn: NodeTurn,
        effect: string,
        payload: EffectPayload,
        attempt: Attempt,
    ): Promise<SubjectRef | null> {
        if (this.door?.repeatGuard === undefined) return null
        return (await this.door.repeatGuard({ effect, payload, turn, ...attempt })) ?? null
    }

    private portsOf(
        turn: NodeTurn,
        scope: NodeModelScope,
        approval: NodeToolApproval | null,
        asks: Array<GraphNodesError>,
        attempt: Attempt,
    ): NodeHostPorts {
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
                const refused = await this.effectRefusal(turn, effect.id, payload, approval, asks)
                if (refused !== null) return refused
                const executor = this.registry.executorOf(effect.id)
                // Inside the ledger's act: a call the step already made is replayed as it was; only a call that would act for real
                // is asked whether it repeats an earlier attempt. A refusal is an answer the ledger never keeps.
                return this.effects.once(
                    turn.workspaceId,
                    effect.id,
                    call,
                    async () =>
                        (await this.repeatRefusal(turn, effect.id, payload, attempt)) ??
                        executor.execute(turn, payload, call),
                    // The ledger keeps what the effect was asked, so a later step can read what this one already did (the send guard).
                    { args: payload },
                )
            },
            callTool: (tool, args, key) => {
                if (this.door === null) {
                    throw new GraphNodesError({ code: GraphNodesErrorCode.ToolDoorMissing, params: { tool: tool.id } })
                }
                const call = { token: this.tokens?.mint(turn) ?? "", tool: tool.id, args, key, approval }
                return this.door.call(call).catch((cause: unknown) => {
                    if (cause instanceof GraphNodesError && cause.code === GraphNodesErrorCode.ToolApprovalRequired)
                        asks.push(cause)
                    throw cause
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
