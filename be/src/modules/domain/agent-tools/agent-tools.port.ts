import type {
    ApprovalRequest,
    ApprovalResult,
    BookingToolName,
    JsonResult,
    KnowledgePassages,
    LeadDraft,
    LeadWriteResult,
    OptionalLeadId,
    ToolArgs,
    ToolContext,
    OptionalToolClaims,
} from "./agent-tools.contracts"

/** Reads the PUBLIC customer knowledge of the conversation's own installation (owner: the knowledge lane). */
export interface KnowledgeSearch {
    /** The passages and citations for a query; customer audience only. */
    search(ctx: ToolContext, query: string): Promise<KnowledgePassages>
}

/**
 * Writes the lead the agent captured (owner: the decisions side). The adapter sends the handoff_lead command through the gate, and keeps the
 * rule that a conversation already tied to a lead is not rewritten from a chat tool.
 */
export interface LeadWriter {
    /** Creates or updates the lead of the conversation. */
    createOrUpdate(ctx: ToolContext, lead: LeadDraft): Promise<LeadWriteResult>
}

/** Runs the booking tools (owner: the booking lane). The adapter traces the call itself. */
export interface BookingTools {
    /** Runs one booking tool for the job's own conversation. */
    run(ctx: ToolContext, tool: BookingToolName, args: ToolArgs): Promise<JsonResult>
}

/**
 * Asks the owner to approve an answer. The decisions lane implements it with WorkEngineService.runWork (action reply_customer, subject
 * conversation, dedupeKey reply_customer:engine:<jobId>, preset, noChain, forceAsk = reason) and escalates to staff when the item waits for a decision.
 */
export interface ApprovalRequester {
    /** Opens the approval work item. */
    request(ctx: ToolContext, request: ApprovalRequest): Promise<ApprovalResult>
}

/** Hands a conversation to a person (owner: the channels lane). */
export interface HandoffTool {
    /** Marks the conversation handled by a person and posts the system line. */
    handoff(ctx: ToolContext, reason: string): Promise<void>
}

/** Reads the lead a conversation is tied to (owner: the channels lane), for the evidence trace. */
export interface ConversationLeads {
    /** The lead of the conversation, or null. */
    leadIdOf(ctx: ToolContext): Promise<OptionalLeadId>
}

/** The short-lived per-job tool tokens; the app root binds it to the OpenClaw ToolTokenService. */
export interface ToolTokens {
    /** Mints a token for a job; an empty text when the bridge has no secret. */
    mint(subject: ToolContext, ttlSeconds: number): string
    /** Ends the token of a job. */
    revoke(jobId: string): void
    /** The claims of a valid token of a running job, or null. */
    verify(token: string): OptionalToolClaims
}
