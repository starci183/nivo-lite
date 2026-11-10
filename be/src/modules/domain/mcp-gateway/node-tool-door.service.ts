import { Injectable, Optional } from "@nestjs/common"
import {
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
} from "@modules/domain/graph-nodes"
import type { NodeRunClaims, NodeToolCall, NodeToolDoor } from "@modules/domain/graph-nodes"
import { AgentViewScopeService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { audienceOfModule } from "./caller-audience.policy"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import { runOfClaims } from "./gateway-run.policy"
import type { StepClaims } from "./gateway-run.policy"
import type { GatewayCallResult, GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
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
    if (result.code === "not_granted")
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolNotGranted,
            params: { tool, reason: result.detail === tool ? "no_tool_grant" : result.detail },
        })
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
 * the accounts and the credentials live on the workspace connection. The call key is the replay key of the step. Every refusal and failure
 * other than an approval to ask is logged with its typed code, the gateway code and the reason (`mcp-gateway.node-tool.failed`), so a node
 * that survives the failure (a payment request that tells the owner instead) never hides why.
 */
export class NodeToolDoorService implements NodeToolDoor {
    constructor(
        private readonly gateway: McpGatewayService,
        private readonly tokens: GraphNodeRunTokensService,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly members?: WorkspaceMembersReadService,
        @Optional() private readonly scopes?: AgentViewScopeService,
    ) {}

    /** Calls the tool for the run its token names and answers its value. */
    async call(call: NodeToolCall): Promise<unknown> {
        const claims = this.tokens.verify(call.token)
        if (claims === null) {
            throw this.failed(
                call.tool,
                null,
                new GraphNodesError({ code: GraphNodesErrorCode.ToolTokenInvalid, params: { tool: call.tool } }),
            )
        }
        const checked = gatewayArgumentsSchema.safeParse(call.args)
        if (!checked.success) {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolFailed,
                    params: { tool: call.tool, reason: "invalid_arguments" },
                }),
            )
        }
        const fingerprint = toolFingerprintOf(call.tool, checked.data)
        const approvedBy = call.approval?.fingerprint === fingerprint ? call.approval.by : undefined
        if (approvedBy === undefined && !(await this.memberMayCall(claims))) {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolFailed,
                    params: { tool: call.tool, reason: "member_not_allowed" },
                }),
            )
        }
        const caller = await this.callerOf(claims, call.key, approvedBy)
        const result = await this.gateway.call(caller, call.tool, checked.data)
        if (result.ok) return result.value
        const error = failureOf(call.tool, fingerprint, result)
        if (error.code === GraphNodesErrorCode.ToolApprovalRequired) throw error
        throw this.failed(call.tool, claims, error, result.code)
    }

    /**
     * Who the step's agent talks to. A run for the workspace is internal. A run a customer started is the customer's unless its agent
     * belongs to an internal module (the accounting step of a run the front desk started): then the agent's own audience holds, read
     * from its module under the catalogue's default deny; where no agent scope can be read, the customer's.
     */
    private async audienceOf(claims: NodeRunClaims): Promise<NonNullable<GatewayCaller["audience"]>> {
        if (claims.scope !== "public") return "internal"
        if (this.scopes === undefined) return "customer"
        const scope = await this.scopes.lensOf(claims.workspaceId, claims.agentId)
        return audienceOfModule(scope?.module ?? null)
    }

    /** Logs a refused or failed call with its cause (the typed code, the gateway code, the reason) and answers the error to throw. */
    private failed(
        tool: string,
        claims: NodeRunClaims | null,
        error: GraphNodesError,
        gatewayCode: string | null = null,
    ): GraphNodesError {
        this.logger.warn(McpGatewayLogEvent.NodeToolFailed, {
            workspaceId: claims?.workspaceId ?? null,
            agentId: claims?.agentId ?? null,
            runId: claims?.runId ?? null,
            tool,
            code: error.code,
            gatewayCode,
            reason: typeof error.params.reason === "string" ? error.params.reason : null,
        })
        return error
    }

    /**
     * The gateway caller of the run: its agent and conversation, its audience, the person who approved, if any, and the graph step the
     * token signs (its language, hand-off, lead and allow-list), which the NIVO effect tools need. Every call of this door is a
     * workflow step (`graphStep`).
     */
    private async callerOf(claims: StepClaims, key: string, approvedBy: string | undefined): Promise<GatewayCaller> {
        const run = runOfClaims(claims)
        return {
            workspaceId: claims.workspaceId,
            agentId: claims.agentId,
            conversationId: claims.conversationId,
            workItemId: null,
            opKey: key,
            turnId: claims.runId,
            audience: await this.audienceOf(claims),
            graphStep: true,
            ...(approvedBy === undefined ? {} : { approvedBy }),
            ...(run === undefined ? {} : { run }),
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
