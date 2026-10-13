/** A scalar value a gate request carries in its fields. */
export type GateFieldValue = string | number | boolean | null

/** What a module asks the approval gate to decide: one action on one subject. */
export interface ApprovalRequest {
    /** The workspace the action belongs to. */
    readonly workspaceId: string
    /** Who asks, as shown in the log. */
    readonly actor: string
    /** The gated action id, for example `send_purchase_order`. */
    readonly action: string
    /** The kind of subject the action is about. */
    readonly subjectType: string
    /** The subject id. */
    readonly subjectId: string
    /** The key that makes a repeated ask a no-op. */
    readonly dedupeKey: string
    /** One line the owner reads when asked to decide. */
    readonly summary: string
    /** The prepared text (a message, an email) the owner may edit, when the action has one. */
    readonly draft?: string
    /** The amount at stake, when the owner's limit applies. */
    readonly amountVnd?: number
    /** The scalar facts the performer needs once the action is allowed. */
    readonly fields: Readonly<Record<string, GateFieldValue>>
}

/** What a decision about a gated action ended in. */
export interface ApprovalResult {
    /** The status of the work item: `done` when the action ran, `waiting_decision` when a person must decide. */
    readonly status: string
    /** The work item that records the decision. */
    readonly workItemId: string
}

/** A person's decision about a waiting work item. */
export interface ApprovalDecision {
    /** The workspace the work item belongs to. */
    readonly workspaceId: string
    /** The work item to decide. */
    readonly workItemId: string
    /** The decision. */
    readonly decision: "approved" | "rejected"
    /** The member who decides. */
    readonly decidedBy: string
}

/** The facts a performer receives when the gate lets an action through. */
export interface PerformContext {
    /** The workspace the action belongs to. */
    readonly workspaceId: string
    /** The work item that carries the decision. */
    readonly workItemId: string
    /** Who performs, as shown in the log. */
    readonly actor: string
    /** The prepared text, possibly edited by the owner. */
    readonly draft: string | null
    /** The scalar facts the request carried. */
    readonly fields: Readonly<Record<string, GateFieldValue>>
}

/** What a performer reports to the gate. */
export interface PerformResult {
    /** One line saying what happened. */
    readonly summary: string
    /** Whether the proof of the effect was captured or is still pending. */
    readonly evidence: "captured" | "pending"
    /** The page that shows the result, when there is one. */
    readonly href?: string
    /** The longer text behind the summary, when there is one. */
    readonly detail?: string
}

/** A text the generator was asked for. */
export interface TextRequest {
    /** The workspace the text is written for. */
    readonly workspaceId: string
    /** The purpose id used for metering, for example `inventory_po_message`. */
    readonly purpose: string
    /** The module that asks. */
    readonly module: string
    /** The instruction that fixes the role and the format of the answer. */
    readonly system: string
    /** The task and its facts. */
    readonly user: string
    /** How long to wait before the caller falls back. */
    readonly timeoutMs: number
}

/** What the generator answered. */
export interface TextResult {
    /** True when the model answered. */
    readonly ok: boolean
    /** The answer, empty when it did not. */
    readonly output: string
}

/** One notice email. */
export interface MailNotice {
    /** The workspace that sends. */
    readonly workspaceId: string
    /** The recipient address. */
    readonly to: string
    /** The subject line. */
    readonly subject: string
    /** The title shown at the top of the mail body. */
    readonly title: string
    /** The plain body; the sender renders it into the workspace layout. */
    readonly body: string
    /** The purpose id used for metering. */
    readonly purpose: string
    /** Whether the mail goes to the owner or to someone outside the business. */
    readonly audience: "owner" | "customer"
    /** Ids the sent mail is traced by. */
    readonly refs?: Readonly<Record<string, string>>
    /** The gate decision that allowed the mail, when there is one. */
    readonly workItemId?: string
}

/** What sending a notice ended in. */
export interface MailResult {
    /** `sent` when the mail left, `failed` otherwise. */
    readonly status: "sent" | "failed"
    /** Why it failed, as a code. */
    readonly error?: string
}

/** One evidence event of a module. */
export interface EvidenceEntry {
    /** The event kind, `<module>.<what>`. */
    readonly kind: string
    /** Who acted, as shown in the log. */
    readonly actor: string
    /** One line saying what happened. */
    readonly summary: string
    /** The proof or detail behind the summary. */
    readonly evidence?: string | null
    /** The work item the event belongs to. */
    readonly workItemId?: string | null
}

/** One entry of the decision log: who decided what, how and why. */
export interface DecisionEntry {
    /** The department the action belongs to. */
    readonly department: string
    /** The gated action id. */
    readonly action: string
    /** Who decided, as shown in the log. */
    readonly decidedBy: string
    /** Whether a policy, the owner or a staff member decided. */
    readonly deciderKind: "policy" | "owner" | "staff"
    /** How the decision ended. */
    readonly outcome: "auto_done" | "approved" | "edited" | "rejected"
    /** The reason code of the decision. */
    readonly reason?: string | null
    /** A free note. */
    readonly note?: string | null
}
