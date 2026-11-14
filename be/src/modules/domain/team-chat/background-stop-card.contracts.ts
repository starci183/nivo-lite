/**
 * The `background.stopped` card: its payload contract is the agent-sdk core kind (`backgroundStoppedKind`, nivo-frame `team-chat`
 * rule 10); this file re-exports it for be and keeps the be-only shapes (the view, the report, how a post went).
 */
import type { BackgroundStopReason, BackgroundStoppedPayload, BackgroundWork } from "@nivo-lite/agent-sdk/team-chat"

export { BACKGROUND_STOP_REASONS, BACKGROUND_TARGETS, BACKGROUND_WORKS } from "@nivo-lite/agent-sdk/team-chat"
export type {
    BackgroundStopReason,
    BackgroundStoppedPayload,
    BackgroundStoppedTarget,
    BackgroundTarget,
    BackgroundWork,
} from "@nivo-lite/agent-sdk/team-chat"

/** A `background.stopped` card as a screen reads it. */
export type BackgroundStoppedCardView = Omit<BackgroundStoppedPayload, "version">

/** The card a line carries, or null when it carries none (or another kind). */
export type OptionalBackgroundStoppedCardView = BackgroundStoppedCardView | null

/** The stored payload of a line, or null when it carries none (or another kind). */
export type OptionalBackgroundStoppedPayload = BackgroundStoppedPayload | null

/** The structured message a line stores as JSON text, or null for a plain line. */
export type StoredAgentMessage = string | null

/** One stop of a background work to report: what, why, and the episode it belongs to (one card per episode, never per retry). */
export interface BackgroundStopReport {
    /** What stopped. */
    readonly work: BackgroundWork
    /** Why it stopped. */
    readonly reason: BackgroundStopReason
    /**
     * The failure episode: a value that stays the same across the retries of one failure and changes with a new request (the derive
     * pass gives the time its pass was asked for).
     */
    readonly episode: Date
}

/** How a report went: posted now, already posted for this episode, or not posted (the workspace has no owner). */
export type BackgroundStopPosted = "posted" | "already" | "no_owner"
