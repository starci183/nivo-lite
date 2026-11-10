import { Injectable, Optional } from "@nestjs/common"
import {
    GraphNodeRegistryService,
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
} from "@modules/domain/graph-nodes"
import type { NodeEffectRightCall, NodeRunClaims, NodeToolCall, NodeToolDoor } from "@modules/domain/graph-nodes"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import { AgentViewScopeService } from "@modules/domain/agents"
import { LOCKED_ARGUMENTS, isLockedContextRead } from "@modules/domain/context-sources"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { audienceOfModule } from "./caller-audience.policy"
import { callWordsOf } from "./connector-call.policy"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import { runOfClaims } from "./gateway-run.policy"
import type { StepClaims } from "./gateway-run.policy"
import type { GatewayArgument, GatewayCallResult, GatewayCaller } from "./mcp-gateway.contracts"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { McpGatewayService } from "./mcp-gateway.service"
import { isAbilityTool, isChannelBound } from "./provider-abilities.policy"
import { ProviderAbilitiesService } from "./provider-abilities.service"
import { ALREADY_TOLD, LINE_KIND, LINES_LOOKED_AT, answeredSince, toldBefore } from "./repeat-send.policy"

/** One effect the door is asked about before it acts for real (the host's repeat-guard call). */
type RepeatGuardCall = Parameters<NonNullable<NodeToolDoor["repeatGuard"]>>[0]

/** The reason a native tool gives when the workspace has no connected provider for it. */
const NOT_CONNECTED = "not_connected"

/** The reason a native tool gives when the provider refused the workspace's connection: only the owner can cure it. */
const CONNECTION_REFUSED = "connection_refused"

/** The most governing seats read to judge the member behind a turn. */
const STEWARDS_MAX = 50

/**
 * The arguments of a call a person is asked to approve, in plain words (bounded names and values, at most the card's count), so the
 * permission request can show them, as one JSON text (error params are texts or numbers); the raw payload never rides the error.
 */
const askedArgsOf = (args: unknown): string =>
    JSON.stringify(Object.fromEntries(callWordsOf(args).map((word) => [word.name, word.value])))

/** The checked arguments of a call. */
type GatewayArguments = Readonly<Record<string, GatewayArgument>>

/** The arguments a call runs with after the hard lock of a context read, or why the lock refused it. */
type LockedArguments =
    | { readonly kind: "ok"; readonly args: GatewayArguments }
    | { readonly kind: "refused"; readonly reason: "other_conversation" | "other_lead" }

/**
 * The hard lock of the context reads (`nivo.conversation.*`, `nivo.lead.*`): they take no conversation or customer id from the model.
 * A call that names one other than the run's own (from the run token: its conversation, its customer) is refused here, before the
 * gateway and its executor; the run's own ids are then filled in from the token, never from what the call says. Any other tool runs
 * with its arguments as given.
 */
const lockedArgumentsOf = (tool: string, claims: StepClaims, args: GatewayArguments): LockedArguments => {
    if (!isLockedContextRead(tool)) return { kind: "ok", args }
    const own = { conversationId: claims.conversationId, leadId: claims.leadId ?? null }
    for (const name of LOCKED_ARGUMENTS) {
        const named = args[name]
        if (named !== undefined && named !== own[name]) {
            return { kind: "refused", reason: name === "conversationId" ? "other_conversation" : "other_lead" }
        }
    }
    const filled = Object.fromEntries(
        Object.entries(own).filter((entry): entry is [string, string] => entry[1] !== null),
    )
    return { kind: "ok", args: { ...args, ...filled } }
}

/** The typed error of a gateway answer that is not a value. */
const failureOf = (
    tool: string,
    fingerprint: string,
    result: Exclude<GatewayCallResult, { ok: true }>,
    args: unknown,
): GraphNodesError => {
    if (result.code === "approval_required") {
        return new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool, fingerprint, reason: result.reason, args: askedArgsOf(args) },
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
        @Optional() private readonly abilities?: ProviderAbilitiesService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly conversations?: ChatConversationsService,
    ) {}

    /**
     * One customer line per stop, ever: refuses a `nivo.lead.message.send` that would tell a customer again for the same stop. The
     * step (the same run and step key, on any engine) already sent a line to the conversation the call addresses in an EARLIER attempt
     * (so it ran, told the customer and did not complete: it stopped, was parked, re-driven or resumed), and no person has answered
     * its report since that line. The refusal is an ordinary fact the step reads (`already_told_for_this_stop`, with the line and its
     * time) and moves on from. It lifts when the founder answers (the turn then carries an answer newer than the line: the step may
     * say how it ended) and never applies to the lines of one attempt. It reads no business: the same step, the same conversation, no
     * newer answer. A message addressed by the customer (`leadId`) is judged on the conversation the send would pick.
     */
    async repeatGuard(call: RepeatGuardCall): Promise<SubjectRef | null> {
        if (call.effect !== TOOL.customerMessageSend) return null
        const lines = this.registry?.optionalPortOf(LINE_KIND)
        if (lines === undefined) return null
        const conversationId = await this.addressedOf(call.turn.workspaceId, call.payload)
        if (conversationId === null) return null
        const rows = await lines.read(
            call.turn,
            {
                where: { conversationId, role: "agent" },
                fields: ["text", "sentAt", "channelRef"],
                limit: LINES_LOOKED_AT,
            },
            "workspace",
        )
        const told = toldBefore(rows, call.step, call.startedAt)
        if (told === null || answeredSince(call.turn.founderAnswers, told)) return null
        this.logger.info(McpGatewayLogEvent.RepeatSendRefused, {
            workspaceId: call.turn.workspaceId,
            agentId: call.turn.agentId,
            step: call.step,
            conversationId,
        })
        return { kind: "refused", id: ALREADY_TOLD, facts: { conversationId, line: told.text, at: told.at } }
    }

    /**
     * The conversation a send addresses: the one it names, or for a message addressed by the customer the one the send would pick (the
     * customer's most recently active conversation, on the channel asked for when it asks for one); null when it names neither or the
     * customer has none (the send itself then answers its own refusal).
     */
    private async addressedOf(workspaceId: string, payload: RepeatGuardCall["payload"]): Promise<string | null> {
        if (typeof payload.conversationId === "string") return payload.conversationId
        if (typeof payload.leadId !== "string" || this.conversations === undefined) return null
        const channel = typeof payload.channel === "string" ? payload.channel : undefined
        const all = await this.conversations.ofLeads(workspaceId, [payload.leadId])
        return all.find((conversation) => channel === undefined || conversation.channel === channel)?.id ?? null
    }

    /**
     * The right of the run's agent to perform an effect through `context.effect`, judged as the gateway judges the same tool, so the
     * two roads to an effect cannot disagree. An effect that is no provider right, or whose provider only its conversation tells (the
     * customer send: its executor asks), is not judged here. Not attached or not ticked: the ordinary refusal fact
     * `{ kind: "refused", id, facts }`, which the step reads and the engine reports. Ticked `ask`: the typed approval error with the
     * fingerprint of the effect and its payload, unless the call replays an approval of that fingerprint.
     */
    async effectRight(call: NodeEffectRightCall): Promise<SubjectRef | null> {
        if (this.abilities === undefined || !isAbilityTool(call.effect) || isChannelBound(call.effect)) return null
        const claims = this.tokens.verify(call.token)
        if (claims === null) {
            throw this.failed(
                call.effect,
                null,
                new GraphNodesError({ code: GraphNodesErrorCode.ToolTokenInvalid, params: { tool: call.effect } }),
            )
        }
        const fingerprint = toolFingerprintOf(call.effect, call.payload)
        const approved = call.approval?.fingerprint === fingerprint
        const verdict = await this.abilities.judge(claims.workspaceId, claims.agentId, call.effect, approved)
        if (verdict === null || verdict.kind === "allow") return null
        if (verdict.kind === "approval") {
            throw new GraphNodesError({
                code: GraphNodesErrorCode.ToolApprovalRequired,
                params: { tool: call.effect, fingerprint, reason: "ask_mode", args: askedArgsOf(call.payload) },
            })
        }
        this.failed(
            call.effect,
            claims,
            new GraphNodesError({
                code: GraphNodesErrorCode.ToolNotGranted,
                params: { tool: call.effect, reason: verdict.reason },
            }),
        )
        return {
            kind: "refused",
            id: verdict.reason,
            facts: { tool: call.effect, ability: verdict.ability, providers: [...verdict.providers] },
        }
    }

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
        const locked = lockedArgumentsOf(call.tool, claims, checked.data)
        if (locked.kind === "refused") {
            throw this.failed(
                call.tool,
                claims,
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolNotGranted,
                    params: { tool: call.tool, reason: locked.reason },
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
        const result = await this.gateway.call(caller, call.tool, locked.args)
        if (result.ok) return result.value
        const error = failureOf(call.tool, fingerprint, result, checked.data)
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
