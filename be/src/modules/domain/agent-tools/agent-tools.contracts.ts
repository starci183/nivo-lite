/** The arguments of a tool call as OpenClaw sent them: untrusted, sanitised by the tool-args policy. */
export interface ToolArgs {
    /** Any member. */
    readonly [key: string]: unknown
}

/** The JSON object a tool answers with. */
export interface JsonResult {
    /** Any member. */
    readonly [key: string]: unknown
}

/** The job a tool call runs for (and a token is minted for), taken only from the verified token claims. */
export interface ToolContext {
    /** The job whose token was presented. */
    readonly jobId: string
    /** The workspace of the job. */
    readonly workspaceId: string
    /** The conversation of the job. */
    readonly conversationId: string
}

/** One tool OpenClaw may call. */
export interface ToolManifestEntry {
    /** The dotted tool name. */
    readonly name: string
    /** What the tool does, for the model. */
    readonly description: string
    /** Argument name to type text; a trailing question mark marks an optional argument. */
    readonly args: Readonly<Record<string, string>>
}

/** The booking tools served by the booking lane. */
export type BookingToolName = "booking.find_slots" | "booking.request"

/** One public knowledge citation. */
export interface KnowledgeCitation {
    /** The title of the source. */
    readonly title: string
    /** The topic of the source. */
    readonly topic: string
}

/** The public knowledge passages that answer a question. */
export interface KnowledgePassages {
    /** The passages as one block of text for the model. */
    readonly passages: string
    /** Where the passages come from. */
    readonly citations: ReadonlyArray<KnowledgeCitation>
}

/** A customer captured by the agent during a chat, already clipped. */
export interface LeadDraft {
    /** The customer's name. */
    readonly contactName: string
    /** What the customer needs. */
    readonly need: string
    /** The customer's company, or null. */
    readonly company: string | null
    /** Phone, else email, or null. */
    readonly contact: string | null
}

/** What happened to a lead write. */
export interface LeadWriteResult {
    /** The lead the conversation is tied to, or null (a duplicate). */
    readonly leadId: string | null
    /** The gate status, `exists` or `duplicate`. */
    readonly status: string
}

/** Why the agent asks the owner. */
export type ApprovalReason = "over_authority" | "unclear_outcome"

/** A request for the owner to approve an answer, already clipped. */
export interface ApprovalRequest {
    /** The customer's question. */
    readonly question: string
    /** The answer the agent proposes, or null. */
    readonly proposedAnswer: string | null
    /** Why the agent cannot answer alone. */
    readonly reason: ApprovalReason
}

/** What happened to an approval request. */
export interface ApprovalResult {
    /** The work item that carries the request. */
    readonly workItemId: string
    /** The status of the work item. */
    readonly status: string
}

/** A lead id, or null when there is none. */
export type OptionalLeadId = string | null

/** The claims of a tool token: its job and an expiry in unix seconds. */
export interface ToolClaims extends ToolContext {
    /** Expiry, unix seconds. */
    readonly exp: number
}

/** The claims of a valid token, or null. */
export type OptionalToolClaims = ToolClaims | null
