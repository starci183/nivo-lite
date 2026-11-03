import { Injectable, Optional } from "@nestjs/common"
import { runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeHostPorts, NodeRun } from "@nivo-lite/agent-sdk/node"
import { AiTasksService } from "@modules/domain/ai-tasks"
import type { AiTaskScope } from "@modules/domain/ai-tasks"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { InjectGraphNodeToolDoor } from "./graph-nodes.decorators"
import type { NodeRunInput, NodeToolDoor, NodeTurn } from "./graph-nodes.contracts"

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
        private readonly ai: AiTasksService,
        @Optional() @InjectGraphNodeToolDoor() private readonly door: NodeToolDoor | null = null,
    ) {}

    /** Runs the node and answers its parsed output and the effects it ran. */
    run(input: NodeRunInput): Promise<NodeRun> {
        const installed = this.registry.installed()
        return runNode(
            {
                node: this.registry.nodeOf(input.nodeId),
                params: input.params,
                input: input.input,
                turn: input.turn,
                grant: input.grant,
                effects: installed.effects,
                tools: installed.tools,
                key: input.key,
            },
            this.portsOf(input.turn),
        )
    }

    private portsOf(turn: NodeTurn): NodeHostPorts {
        const scope: AiTaskScope = { workspaceId: turn.workspaceId, locale: turn.locale }
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
                return this.door.call(turn, tool.id, args, key)
            },
            model: {
                text: (ask) => this.ai.nodeText(scope, ask),
                json: async (schema, ask) => schema.parse(await this.ai.nodeJson(scope, ask, schema)),
            },
            now: () => new Date(),
        }
    }
}
