import { Injectable, Optional } from "@nestjs/common"
import {
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
    type NodeRunClaims,
    type NodeToolCall,
    type NodeToolDoor,
} from "@modules/domain/graph-nodes"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import type { GatewayCallResult, GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayService } from "./mcp-gateway.service"

/** The reason a native tool gives when the workspace has no connected provider for it. */
const NOT_CONNECTED = "not_connected"

/** The reason a native tool gives when the provider refused the workspace's connection: only the owner can cure it. */
const CONNECTION_REFUSED = "connection_refused"

/** The most governing seats read to judge the member behind a turn. */
const STEWARDS_MAX = 50

/** The typed error of a gateway answer that is not a value. */
const failureOf = (
    tool: string,
    fingerprint: string,
    result: Exclude<GatewayCallResult, { ok: true }>,
): GraphNodesError => {
    if (result.code === "approval_required") {
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool, fingerprint, reason: result.reason },
        })
    }
    if (result.code === "tool_error" && result.detail.includes(NOT_CONNECTED))
        return new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool } })
    if (result.code === "tool_error" && result.detail.includes(CONNECTION_REFUSED))
        return new GraphNodesError({ code: GraphNodesErrorCode.ToolConnectionRefused, params: { tool } })
    return new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool, reason: result.code } })
}

@Injectable()
/**
 * The door every node tool call goes through: the NIVO MCP gateway. Who calls is the run token the host minted (workspace, agent, run,
 * who the run acts for, what it may read), never what a node says: a call without a valid token is refused. What is allowed is the
 * intersection, default deny: the agent's grant per tool and its limits (the gateway), the member behind the turn (an owner or manager
 * seat; any other member's turn calls nothing unless a person approved it), the turn's scope (a customer's turn calls as the customer
 * audience, public knowledge only), and the provider's consent on the workspace connection (the provider answers it). A grant that asks
 * a person is the typed `GRAPH_NODES_TOOL_APPROVAL_REQUIRED` with the fingerprint of the exact tool and arguments; a call that replays an
 * approval of that fingerprint runs as approved, and changed arguments ask again. The node passes business data only: the destination,
 * the accounts and the credentials live on the workspace connection. The call key is the replay key of the step.
 */
export class NodeToolDoorService implements NodeToolDoor {
    constructor(
        private readonly gateway: McpGatewayService,
        private readonly tokens: GraphNodeRunTokensService,
        @Optional() private readonly members?: WorkspaceMembersReadService,
    ) {}

    /** Calls the tool for the run its token names and answers its value. */
    async call(call: NodeToolCall): Promise<unknown> {
        const claims = this.tokens.verify(call.token)
        if (claims === null)
            throw new GraphNodesError({ code: GraphNodesErrorCode.ToolTokenInvalid, params: { tool: call.tool } })
        const checked = gatewayArgumentsSchema.safeParse(call.args)
        if (!checked.success) {
            throw new GraphNodesError({
                code: GraphNodesErrorCode.ToolFailed,
                params: { tool: call.tool, reason: "invalid_arguments" },
            })
        }
        const fingerprint = toolFingerprintOf(call.tool, checked.data)
        const approvedBy = call.approval?.fingerprint === fingerprint ? call.approval.by : undefined
        if (approvedBy === undefined && !(await this.memberMayCall(claims))) {
            throw new GraphNodesError({
                code: GraphNodesErrorCode.ToolFailed,
                params: { tool: call.tool, reason: "member_not_allowed" },
            })
        }
        const result = await this.gateway.call(this.callerOf(claims, call.key, approvedBy), call.tool, checked.data)
        if (result.ok) return result.value
        throw failureOf(call.tool, fingerprint, result)
    }

    /** The gateway caller of the run: its agent and conversation, the audience of its scope, and the person who approved, if any. */
    private callerOf(claims: NodeRunClaims, key: string, approvedBy: string | undefined): GatewayCaller {
        return {
            workspaceId: claims.workspaceId,
            agentId: claims.agentId,
            conversationId: claims.conversationId,
            workItemId: null,
            opKey: key,
            turnId: claims.runId,
            audience: claims.scope === "public" ? "customer" : "internal",
            ...(approvedBy === undefined ? {} : { approvedBy }),
        }
    }

    /** True for a run no person stands behind, and for one an owner or manager of the workspace does; default deny otherwise. */
    private async memberMayCall(claims: NodeRunClaims): Promise<boolean> {
        if (claims.memberId === null) return true
        if (this.members === undefined) return false
        const stewards = await this.members.firstStewards(claims.workspaceId, STEWARDS_MAX)
        return stewards.some((seat) => seat.seat_id === claims.memberId)
    }
}
