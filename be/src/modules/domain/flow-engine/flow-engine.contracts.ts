import type { InboxSimulationInput, InboxSimulationReceipt } from "@modules/domain/inbox-simulation"
import type { AuthorityProfile } from "@modules/domain/authority"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { WorkItem } from "@modules/domain/decisions"

/** What the owner's plain-words grant of authority changed. */
export interface AuthorityChatAnswer {
    /** One line for the owner: what was saved, or that nothing was. */
    readonly summary: string
    /** The authority sheet after the change; null before the workspace has one. */
    readonly authority: AuthorityProfile | null
    /** Every rule of the workspace after the change. */
    readonly rules: ReadonlyArray<AuthorityRuleRecord>
}

/** What NIVO answers to a message the owner wrote in Office. */
export interface OwnerChatAnswer {
    /** True when NIVO acted on the message (an authority change, a typed decision, or a refusal). */
    readonly handled: boolean
    /** NIVO's reply in the thread, when it has one. */
    readonly reply?: string
    /** True when the engine already wrote the confirmation in Office. */
    readonly posted: boolean
}

/** A waiting work item as a typed decision reads it: who it is for, its reference and its amount. */
export interface WaitingView {
    /** The work item. */
    readonly item: WorkItem
    /** The customer's name, or blank when the item names none. */
    readonly customer: string
    /** The order, invoice or bank reference, or blank. */
    readonly ref: string
    /** The money involved, VND, or null. */
    readonly amount: number | null
}

/** What a typed decision is: approve or reject. */
export type ChatVerdict = "approved" | "rejected"

/** A verdict, or null when the message decides nothing. */
export type OptionalChatVerdict = ChatVerdict | null

/** The waiting items a typed decision may apply to, after every clue of the message filtered them. */
export interface ChatMatch {
    /** The items that match every clue. */
    readonly pool: ReadonlyArray<WaitingView>
    /** The amount the message names, VND, or null. */
    readonly amount: number | null
    /** True when the message gives any clue (a name, a reference, an amount or a kind of work). */
    readonly clues: boolean
}

/** Where a simulated customer input is recorded and queued for the department work, as the person who asked. */
export interface SimulatedInputs {
    /** Records the input and queues its work; answers the receipt the Inbox simulator gives. */
    request(userId: string, workspaceId: string, input: InboxSimulationInput): Promise<InboxSimulationReceipt>
}
