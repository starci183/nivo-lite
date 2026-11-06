import type { BadgeTone } from "@starci/grammar/common"

/** The stages of a lead journey, in order; the last two close it. */
export type LeadStageId = "new" | "qualified" | "proposal" | "won" | "lost"

/** Who owns a step of a lead journey. */
export type OwnerKind = "human" | "agent"

/** Where a step of a lead journey stands. */
export type StepStatus = "open" | "waiting_approval" | "done"

/** Where an agent draft stands. */
export type DraftStatus = "pending_approval" | "approved" | "rejected"

/** Plain data of one lead as the Leads screens read it. */
export interface LeadRecord {
    readonly id: string
    readonly contact_name: string
    /** The stored phone of the contact; null when none is known. */
    readonly phone: string | null
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly stage: LeadStageId
    /** The AI-prepared brief; null until one is prepared. */
    readonly context_summary: string | null
    readonly created_at: string
}

/** One lead of the list with the owner and next action of its open step. */
export interface LeadListItem extends LeadRecord {
    readonly owner_name: string | null
    readonly next_action: string | null
}

/** One entry of the work flow card: what happened, when, how it stands and the lines that qualify it. */
interface FlowEntryView {
    readonly id: string
    readonly head: string
    readonly when: { readonly iso: string; readonly label: string } | null
    readonly badge: { readonly label: string; readonly tone: BadgeTone } | null
    readonly reason: string | null
    readonly lines: ReadonlyArray<{ readonly id: string; readonly text: string; readonly strong: boolean }>
}

/** One section of the card: its heading, what to say when it is empty and its entries. */
export interface FlowSectionView {
    readonly id: string
    readonly title: string
    readonly emptyText: string
    readonly entries: ReadonlyArray<FlowEntryView>
}
