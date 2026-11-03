import { Injectable } from "@nestjs/common"
import { McpGatewayService, gatewayArgumentsSchema } from "@modules/domain/mcp-gateway"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import type { NodeToolDoor, NodeTurn } from "./graph-nodes.contracts"

/** The reason a native tool gives when the workspace has no connected provider for it. */
const NOT_CONNECTED = "not_connected"

@Injectable()
/**
 * The door every node tool call goes through: the NIVO MCP gateway. The call runs as the turn's agent, so the gateway applies the
 * grant, the approval, the breaker and the audit, and resolves the capability tool (`payment.instruction`, `bank.transactions`) to the
 * provider the workspace connected. The call key is the replay key of the step. A workspace with no connected provider is the typed
 * `GRAPH_NODES_TOOL_NOT_CONNECTED`, which the node turns into a connect work item; any other refusal is `GRAPH_NODES_TOOL_FAILED`.
 */
export class GraphNodeToolDoorService implements NodeToolDoor {
    constructor(private readonly gateway: McpGatewayService) {}

    /** Calls the tool for the turn and answers its value. */
    async call(turn: NodeTurn, tool: string, args: Readonly<Record<string, unknown>>, key: string): Promise<unknown> {
        const checked = gatewayArgumentsSchema.safeParse(args)
        if (!checked.success) {
            throw new GraphNodesError({
                code: GraphNodesErrorCode.ToolFailed,
                params: { tool, reason: "invalid_arguments" },
            })
        }
        const result = await this.gateway.call(
            {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                conversationId: turn.conversationId,
                workItemId: null,
                opKey: key,
            },
            tool,
            checked.data,
        )
        if (result.ok) return result.value
        if (result.code === "tool_error" && result.detail.includes(NOT_CONNECTED)) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool } })
        }
        throw new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool, reason: result.code } })
    }
}
