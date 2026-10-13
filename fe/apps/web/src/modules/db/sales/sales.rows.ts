import type { DecisionRow, Invoice, Order, WorkItemView } from "@/lib/flow-types"
import type { LeadRecord, ResponsibilityRecord, SalesContract } from "@/modules/types"

/** A customer conversation the workbench watches for an unanswered message. */
export interface ConversationSlim {
    readonly id: string
    readonly lead_id: string | null
    readonly handled_by: string | null
}

/** One message of such a conversation. */
export interface MessageSlim {
    readonly conversation_id: string
    readonly role: string
    readonly body: string
    readonly created_at: string
}

/** A legacy draft still waiting for approval. */
interface DraftSlim {
    readonly id: string
    readonly responsibility_id: string
    readonly draft: string
    readonly created_at: string
}

/** A recorded outcome of a lead. */
interface OutcomeSlim {
    readonly lead_id: string | null
    readonly evidence: string | null
    readonly created_at: string
}

/** The evidence line of something NIVO did by policy. */
interface AutoEvidenceSlim {
    readonly work_item_id: string | null
    readonly evidence: string | null
}

/** Everything the Sales workbench is derived from. */
export interface SalesRows {
    readonly nowMs: number
    readonly leads: ReadonlyArray<LeadRecord>
    readonly steps: ReadonlyArray<ResponsibilityRecord>
    readonly orders: ReadonlyArray<Order>
    readonly invoices: ReadonlyArray<Invoice>
    readonly conversations: ReadonlyArray<ConversationSlim>
    /** The newest messages of those conversations, newest first. */
    readonly messages: ReadonlyArray<MessageSlim>
    readonly drafts: ReadonlyArray<DraftSlim>
    readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>
    readonly outcomes: ReadonlyArray<OutcomeSlim>
    readonly items: ReadonlyArray<WorkItemView>
    readonly decided: ReadonlyArray<DecisionRow>
    readonly autoEvidence: ReadonlyArray<AutoEvidenceSlim>
    readonly contracts: ReadonlyArray<SalesContract>
    /** True when a customer name marks a test run (UAT or debug leads), which no figure counts. */
    readonly isTestRun: (...names: ReadonlyArray<string | null | undefined>) => boolean
}
