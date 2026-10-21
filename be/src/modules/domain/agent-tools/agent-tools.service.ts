import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import type {
    GatewayToolName,
    JsonResult,
    OptionalAuthorization,
    ToolArgs,
    ToolContext,
    ToolManifestEntry,
} from "./agent-tools.contracts"
import {
    InjectAgentHandoff,
    InjectApprovalRequester,
    InjectBookingTools,
    InjectConversationLeads,
    InjectGatewayTools,
    InjectHandoffTool,
    InjectKnowledgeSearch,
    InjectLeadWriter,
    InjectToolTokens,
} from "./agent-tools.decorators"
import type {
    AgentHandoff,
    ApprovalRequester,
    BookingTools,
    ConversationLeads,
    GatewayTools,
    HandoffTool,
    KnowledgeSearch,
    LeadWriter,
    ToolTokens,
} from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"
import { agentHandoffOf, approvalOf, clipText, handoffReasonOf, leadOf, queryOf } from "./tool-args.policy"
import { bearerTokenOf } from "./tool-bearer.policy"
import { isBookingTool, isGatewayTool, isToolName, TOOL_MANIFEST } from "./tool-manifest.policy"
import type { ToolName } from "./tool-manifest.policy"

/** What the evidence line of a connector meta-tool names: the query of a search, the tool of a call, the sequence as such. */
const subjectOf = (tool: GatewayToolName, args: ToolArgs): unknown => {
    if (tool === "tool.search") return args.query
    return tool === "tool.sequence" ? "steps" : args.name
}

/** Who the evidence lines of a tool call name as the actor. */
const ACTOR = "NIVO engine"
/** How many characters of a search query the evidence summary keeps. */
const SUMMARY_QUERY_CHARS = 100

@Injectable()
/**
 * The tool bridge of the agents. A tool call carries the per-job token of the OpenClaw turn; the workspace and
 * conversation are taken from its claims only, never from the arguments. Each call is dispatched to a port and leaves
 * an evidence line.
 */
export class AgentToolsService {
    constructor(
        @InjectToolTokens() private readonly tokens: ToolTokens,
        private readonly events: EventsService,
        @InjectKnowledgeSearch() private readonly knowledge: KnowledgeSearch,
        @InjectLeadWriter() private readonly leads: LeadWriter,
        @InjectBookingTools() private readonly booking: BookingTools,
        @InjectApprovalRequester() private readonly approvals: ApprovalRequester,
        @InjectHandoffTool() private readonly handoffs: HandoffTool,
        @InjectConversationLeads() private readonly conversations: ConversationLeads,
        @InjectGatewayTools() private readonly gatewayTools: GatewayTools,
        @InjectAgentHandoff() private readonly agentHandoff: AgentHandoff,
    ) {}

    /** Mints the token of a job for the tool bridge; an empty text when the bridge has no secret. */
    issue(subject: ToolContext, ttlSeconds: number): string {
        return this.tokens.mint(subject, ttlSeconds)
    }

    /** Ends the token of a job. */
    revoke(jobId: string): void {
        this.tokens.revoke(jobId)
    }

    /** The tools OpenClaw may call. */
    manifest(): ReadonlyArray<ToolManifestEntry> {
        return TOOL_MANIFEST
    }

    /** The tools OpenClaw may call, answered the way a door awaits them. */
    describeTools(): Promise<ReadonlyArray<ToolManifestEntry>> {
        return Promise.resolve(this.manifest())
    }

    /** Authenticates a tool credential without consuming the call that runTool will account for. */
    authenticateBearer(authorization: OptionalAuthorization): ToolContext {
        const claims = this.tokens.verify(bearerTokenOf(authorization), false)
        if (claims === null) throw new AgentToolsError({ code: AgentToolsErrorCode.TokenInvalid })
        return { jobId: claims.jobId, workspaceId: claims.workspaceId, conversationId: claims.conversationId }
    }

    /** Runs one tool for the job named by the token. */
    async runTool(token: string, tool: string, args: ToolArgs): Promise<JsonResult> {
        const claims = this.tokens.verify(token)
        if (claims === null) throw new AgentToolsError({ code: AgentToolsErrorCode.TokenInvalid })
        if (!isToolName(tool)) {
            throw new AgentToolsError({ code: AgentToolsErrorCode.UnknownTool, params: { tool } })
        }
        const ctx: ToolContext = {
            jobId: claims.jobId,
            workspaceId: claims.workspaceId,
            conversationId: claims.conversationId,
        }
        return await this.dispatch(ctx, tool, args)
    }

    /**
     * Runs one tool for the job named by the bearer token of an Authorization header; a missing or foreign header is a
     * refused token.
     */
    runBearerTool(authorization: OptionalAuthorization, tool: string, args: ToolArgs): Promise<JsonResult> {
        return this.runTool(bearerTokenOf(authorization), tool, args)
    }

    private dispatch(ctx: ToolContext, tool: ToolName, args: ToolArgs): Promise<JsonResult> {
        if (isBookingTool(tool)) return this.booking.run(ctx, tool, args)
        if (isGatewayTool(tool)) return this.callGateway(ctx, tool, args)
        if (tool === "conversation.handOff") return this.handToAgent(ctx, args)
        if (tool === "knowledge.search") return this.searchKnowledge(ctx, args)
        if (tool === "lead.create_or_update") return this.createLead(ctx, args)
        if (tool === "approval.request") return this.requestApproval(ctx, args)
        return this.handOff(ctx, args)
    }

    private async searchKnowledge(ctx: ToolContext, args: ToolArgs): Promise<JsonResult> {
        const query = queryOf(args)
        const found = await this.knowledge.search(ctx, query)
        await this.trace(ctx, "knowledge.search", `Knowledge search: ${query.slice(0, SUMMARY_QUERY_CHARS)}`)
        return {
            passages: found.passages,
            citations: found.citations.map((citation) => ({ title: citation.title, topic: citation.topic })),
        }
    }

    private async createLead(ctx: ToolContext, args: ToolArgs): Promise<JsonResult> {
        const written = await this.leads.createOrUpdate(ctx, leadOf(args))
        await this.events.record({
            workspaceId: ctx.workspaceId,
            kind: "engine.tool.lead.create_or_update",
            actor: ACTOR,
            summary: `Lead handed to Sales through the gate (${written.status})`,
            leadId: written.leadId,
            evidence: ctx.jobId,
        })
        return { lead_id: written.leadId, status: written.status }
    }

    private async requestApproval(ctx: ToolContext, args: ToolArgs): Promise<JsonResult> {
        const result = await this.approvals.request(ctx, approvalOf(args))
        await this.trace(
            ctx,
            "approval.request",
            `Approval requested from the owner (${result.status})`,
            result.workItemId,
        )
        return { work_item_id: result.workItemId, status: result.status }
    }

    private async handOff(ctx: ToolContext, args: ToolArgs): Promise<JsonResult> {
        const reason = handoffReasonOf(args)
        await this.handoffs.handoff(ctx, reason)
        await this.trace(
            ctx,
            "handoff.to_person",
            "Conversation handed to a person",
            reason === "" ? ctx.jobId : reason,
        )
        return { status: "handed_to_person" }
    }

    private async callGateway(ctx: ToolContext, tool: GatewayToolName, args: ToolArgs): Promise<JsonResult> {
        const answer = await this.gatewayTools.run(ctx, tool, args)
        const subject = clipText(subjectOf(tool, args), SUMMARY_QUERY_CHARS)
        await this.trace(ctx, tool, `Connector ${tool}: ${subject}`)
        return answer
    }

    private async handToAgent(ctx: ToolContext, args: ToolArgs): Promise<JsonResult> {
        const request = agentHandoffOf(args)
        const answer = await this.agentHandoff.handOff(ctx, request)
        await this.trace(ctx, "conversation.handOff", `Conversation handed to ${request.to}`, request.note)
        return answer
    }

    /** Appends the evidence line of a tool call; the lead is the one the conversation is tied to. */
    private async trace(ctx: ToolContext, tool: ToolName, summary: string, evidence?: string): Promise<void> {
        await this.events.record({
            workspaceId: ctx.workspaceId,
            kind: `engine.tool.${tool}`,
            actor: ACTOR,
            summary,
            leadId: await this.conversations.leadIdOf(ctx),
            evidence: evidence ?? ctx.jobId,
        })
    }
}
