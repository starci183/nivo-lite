/**
 * The typed chat message `brain.change`: its payload contract is the agent-sdk core kind (`brainChangeKind`, nivo-frame `team-chat`
 * rule 10); this file re-exports it for be and keeps what only the web view adds (the viewer's controls and the AI cost).
 */
import type { BrainChangePayload } from "@nivo-lite/agent-sdk/team-chat"

export {
    BRAIN_CHANGE_EVIDENCE_KINDS,
    BRAIN_CHANGE_KINDS,
    BRAIN_CHANGE_MATCHES,
    BRAIN_CHANGE_ORIGINS,
    BRAIN_CHANGE_STATES,
} from "@nivo-lite/agent-sdk/team-chat"
export type {
    BrainChangeAuthor,
    BrainChangeCurrent,
    BrainChangeDecided,
    BrainChangeEvidence,
    BrainChangeEvidenceKind,
    BrainChangeFactKey,
    BrainChangeKind,
    BrainChangeMatch,
    BrainChangeOrigin,
    BrainChangePayload,
    BrainChangePayloadGiven,
    BrainChangeState,
} from "@nivo-lite/agent-sdk/team-chat"

/** Who views a card: the workspace owner decides, a manager may only turn it down, anyone else reads. */
export type BrainChangeViewerRole = "owner" | "manager" | "member"

/** A `brain.change` card as one viewer sees it: the payload and the two controls this viewer gets. */
export interface BrainChangeCardView extends Omit<BrainChangePayload, "version"> {
    /** Whether this viewer is offered Approve: the workspace owner while the card is open. */
    readonly canApprove: boolean
    /** Whether this viewer is offered Reject: the owner or a manager while the card is open. */
    readonly canReject: boolean
    /**
     * Whether this viewer is offered Keep both (FX5): the workspace owner while the card is open and its value in force is only a
     * near-meaning candidate (`current.match` = `near`): the new value goes in force as its own truth and the other one stays.
     */
    readonly canKeepBoth: boolean
    /** What producing the proposal cost in AI (U1); null for a viewer who is not an owner or manager, or when no cost is known. */
    readonly cost: BrainChangeCost | null
}

/** What producing a change request cost in AI, exact: credits are a fraction of the exact USD, never rounded per call. */
export interface BrainChangeCost {
    /** The credits, an exact fraction. */
    readonly credits: number
    /** The exact cost in USD. */
    readonly usd: number
}
