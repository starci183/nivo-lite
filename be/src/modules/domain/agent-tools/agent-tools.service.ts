import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import { ToolTokenService } from "@modules/integrations/openclaw"
import type { ToolTokenSubject } from "@modules/integrations/openclaw"
import type { ToolArgs, ToolContext, ToolManifestEntry, ToolOutcome } from "./agent-tools.contracts"
import {
    InjectApprovalRequester,
    InjectBookingTools,
    InjectConversationLeads,
    InjectHandoffTool,
    InjectKnowledgeSearch,
    InjectLeadWriter,
} from "./agent-tools.decorators"
import type {
    ApprovalRequester,
    BookingTools,
    ConversationLeads,
    HandoffTool,
    KnowledgeSearch,
    LeadWriter,
} from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"
import { approvalOf, handoffReasonOf, leadOf, queryOf } from "./tool-args.policy"
import { isBookingTool, isToolName, TOOL_MANIFEST } from "./tool-manifest.policy"
import type { ToolName } from "./tool-manifest.policy"

/** Who the evidence lines of a tool call name as the actor. */
const ACTOR = "NIVO engine"
/** How many characters of a search query the evidence summary keeps. */
const SUMMARY_QUERY_CHARS = 100

@Injectable()
/**
 * The tool bridge of the agents. A tool call carries the per-job token of the OpenClaw turn; the workspace and conversation are taken from
 * its claims only, never from the arguments. Each call is dispatched to a port and leaves an evidence line.
 */
export class AgentToolsService {
    constructor(
        private readonly tokens: ToolTokenService,
        private readonly events: EventsService,
        @InjectKnowledgeSearch() private readonly knowledge: KnowledgeSearch,
        @InjectLeadWriter() private readonly leads: LeadWriter,
        @InjectBookingTools() private readonly booking: BookingTools,
        @InjectApprovalRequester() private readonly approvals: ApprovalRequester,
        @InjectHandoffTool() private readonly handoffs: HandoffTool,
        @InjectConversationLeads() private readonly conversations: ConversationLeads,
    ) {}

    /** Mints the token of a job for the tool bridge; an empty text when the bridge has no secret. */
    issue(subject: ToolTokenSubject, ttlSeconds: number): string {
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

    /** Runs one tool for the job named by the token. */
    async runTool(token: string, tool: string, args: ToolArgs): Promise<ToolOutcome> {
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
        return this.dispatch(ctx, tool, args)
    }

    private async dispatch(ctx: ToolContext, tool: ToolName, args: ToolArgs): Promise<ToolOutcome> {
        if (isBookingTool(tool)) return this.booking.run(ctx, tool, args)
        if (tool === "knowledge.search") return this.searchKnowledge(ctx, args)
        if (tool === "lead.create_or_update") return this.createLead(ctx, args)
        if (tool === "approval.request") return this.requestApproval(ctx, args)
        return this.handOff(ctx, args)
    }

    private async searchKnowledge(ctx: ToolContext, args: ToolArgs): Promise<ToolOutcome> {
        const query = queryOf(args)
        const found = await this.knowledge.search(ctx, query)
        await this.trace(ctx, "knowledge.search", `Knowledge search: ${query.slice(0, SUMMARY_QUERY_CHARS)}`)
        return {
            passages: found.passages,
            citations: found.citations.map((citation) => ({ title: citation.title, topic: citation.topic })),
        }
    }

    private async createLead(ctx: ToolContext, args: ToolArgs): Promise<ToolOutcome> {
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

    private async requestApproval(ctx: ToolContext, args: ToolArgs): Promise<ToolOutcome> {
        const result = await this.approvals.request(ctx, approvalOf(args))
        await this.trace(
            ctx,
            "approval.request",
            `Approval requested from the owner (${result.status})`,
            result.workItemId,
        )
        return { work_item_id: result.workItemId, status: result.status }
    }

    private async handOff(ctx: ToolContext, args: ToolArgs): Promise<ToolOutcome> {
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
