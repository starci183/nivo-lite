import type { ApproverGroup } from "@modules/domain/authority-rules"
import type { ApprovalStatus } from "./approval-requests.contracts"

/** A request for approval that has ended, and how. */
export interface SettledRequest {
    /** The request id. */
    readonly id: string
    /** How it ended. */
    readonly status: "approved" | "rejected" | "expired"
    /** The member whose verdict settled it, or null when it expired. */
    readonly resolvedBy: string | null
}

/** A request as a chat card reads it: what it asks, who asked and the approver group it kept. */
export interface RequestCard {
    /** The request id. */
    readonly id: string
    /** The action the request asks about. */
    readonly action: string
    /** The amount of the action; null when it carries none. */
    readonly amount: number | null
    /** What the amount is counted in. */
    readonly unit: string
    /** The agent that asked; null when none did. */
    readonly requestedByAgentId: string | null
    /** The group a branch of an action graph asked in place of the live rule; null for a request of a rule. */
    readonly approverGroup: ApproverGroup | null
}

/** Where a request stands as a chat card shows it: its state, who settled it and whom it asked. */
export interface RequestStanding {
    /** The request id. */
    readonly id: string
    /** Waiting for its approvers, or how it ended. */
    readonly status: ApprovalStatus
    /** When it was settled; null while it waits. */
    readonly resolvedAt: Date | null
    /** The seat that settled it; null while it waits or when it expired. */
    readonly resolvedBy: string | null
    /** The seats the request asked when it opened. */
    readonly askedSeatIds: ReadonlyArray<string>
}

/** A request card, or none when the workspace has no such request. */
export type OptionalRequestCard = RequestCard | null
