import { Injectable, Optional } from "@nestjs/common"
import { runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeHostPorts, NodeRun } from "@nivo-lite/agent-sdk/node"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import { InjectGraphNodeModel, InjectGraphNodeToolDoor } from "./graph-nodes.decorators"
import type {
    NodeModelDoor,
    NodeModelScope,
    NodeRunInput,
    NodeSubjectResolver,
    NodeToolDoor,
    NodeTurn,
    NodeUndoInput,
} from "./graph-nodes.contracts"
import type { NodeToolApproval } from "./node-run-token.contracts"

@Injectable()
/**
 * Runs one installed node for a turn. The SDK's runner does every check (schemas, the node's declared rights against the agent's
 * grant, declared effects and tools); this host only binds the ports: the data port each module registered, the executor of each
 * effect behind the once-per-key ledger, the NIVO MCP door for tools, and the agents' metered model path.
 */
export class GraphNodeHostService {
    constructor(
        private readonly registry: GraphNodeRegistryService,
        private readonly effects: GraphNodeEffectsService,
        @InjectClock() private readonly clock: Clock,
        @InjectGraphNodeModel() private readonly ai: NodeModelDoor,
        @Optional() @InjectGraphNodeToolDoor() private readonly door: NodeToolDoor | null = null,
        @Optional() private readonly tokens?: GraphNodeRunTokensService,
    ) {}

    /** Runs the node and answers its parsed output and the effects it ran. */
    async run(input: NodeRunInput): Promise<NodeRun> {
        const installed = this.registry.installed()
        const node = this.registry.nodeOf(input.nodeId)
        const turn = await this.withSubject(input.turn)
        return runNode(
            {
                node,
                params: input.params,
                input: input.input,
                turn,
                grant: input.grant,
                effects: installed.effects,
                tools: installed.tools,
                key: input.key,
            },
            this.portsOf(turn, input.approval ?? null),
        )
    }

    /**
     * Undoes the effects a node step ran, last first, each through the effect its definition names as its compensation, given the subject
     * the ledger kept. Each undo is keyed by the step and its place, so a compensation tried again undoes nothing twice. An effect with no
     * compensation is skipped: its step was a pivot and the engine never asks to undo it.
     */
    async undo(input: NodeUndoInput): Promise<void> {
        const { effects } = this.registry.installed()
        await eachInOrder([...input.done.entries()].reverse(), async ([index, done]) => {
            const compensation = effects.get(done.id)?.compensation
            const undo = compensation === undefined ? undefined : effects.get(compensation)
            if (undo === undefined) return
            const executor = this.registry.executorOf(undo.id)
            const payload: unknown = undo.payload.parse({ id: done.subject.id })
            if (!isRecord(payload)) return
            const call = { key: `${input.key}:undo:${index}`, dedupeKey: null }
            await this.effects.once(input.turn.workspaceId, undo.id, call, () =>
                executor.execute(input.turn, payload, call),
            )
        })
    }

    /** The turn with its subject: the trigger's own, else the first a module's resolver knows, else none. */
    private withSubject(turn: NodeTurn): Promise<NodeTurn> {
        if (turn.subject !== null) return Promise.resolve(turn)
        return this.firstSubject(turn, this.registry.subjectResolvers())
    }

    /** The turn with the subject of the first resolver that knows one, asked one after the other; the turn as it was when none does. */
    private async firstSubject(turn: NodeTurn, resolvers: ReadonlyArray<NodeSubjectResolver>): Promise<NodeTurn> {
        const [first, ...rest] = resolvers
        if (first === undefined) return turn
        const subject = await first.subjectOf(turn)
        return subject === null ? this.firstSubject(turn, rest) : { ...turn, subject }
    }

    private portsOf(turn: NodeTurn, approval: NodeToolApproval | null): NodeHostPorts {
        const scope: NodeModelScope = { workspaceId: turn.workspaceId, locale: turn.locale }
        return {
            read: (kind, query, rightScope) => this.registry.portOf(kind).read(turn, query, rightScope),
            write: (kind, record) => {
                const port = this.registry.portOf(kind)
                if (port.write === undefined)
                    throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind } })
                return port.write(turn, record)
            },
            execute: (effect, payload, call) => {
                const executor = this.registry.executorOf(effect.id)
                return this.effects.once(turn.workspaceId, effect.id, call, () => executor.execute(turn, payload, call))
            },
            callTool: (tool, args, key) => {
                if (this.door === null) {
                    throw new GraphNodesError({ code: GraphNodesErrorCode.ToolDoorMissing, params: { tool: tool.id } })
                }
                return this.door.call({ token: this.tokens?.mint(turn) ?? "", tool: tool.id, args, key, approval })
            },
            model: {
                text: (ask) => this.ai.nodeText(scope, ask),
                json: async (schema, ask) => schema.parse(await this.ai.nodeJson(scope, ask, schema)),
            },
            now: () => this.clock.now(),
        }
    }
}
