import { Injectable } from "@nestjs/common"
import { GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
import type { NodeToolDoor, NodeTurn } from "@modules/domain/graph-nodes"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import { McpGatewayService } from "./mcp-gateway.service"

/** The reason a native tool gives when the workspace has no connected provider for it. */
const NOT_CONNECTED = "not_connected"

/** The reason a native tool gives when the provider refused the workspace's connection: only the owner can cure it. */
const CONNECTION_REFUSED = "connection_refused"

@Injectable()
/**
 * The door every node tool call goes through: the NIVO MCP gateway. The call runs as the turn's agent, so the gateway applies the
 * grant, the approval, the breaker and the audit, and resolves the capability tool (`payment.instruction`, `bank.transactions`) to the
 * provider the workspace connected. The call key is the replay key of the step. A workspace with no connected provider is the typed
 * `GRAPH_NODES_TOOL_NOT_CONNECTED`, which the node turns into a connect work item; a provider that refused the connection is
 * `GRAPH_NODES_TOOL_CONNECTION_REFUSED`, which only the owner cures; any other refusal is `GRAPH_NODES_TOOL_FAILED`.
 */
export class NodeToolDoorService implements NodeToolDoor {
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
        if (result.code === "tool_error" && result.detail.includes(CONNECTION_REFUSED)) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.ToolConnectionRefused, params: { tool } })
        }
        throw new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool, reason: result.code } })
    }
}
