import type { SalesSettings } from "./settings"

/** The stages of a lead, in the order of the pipeline. */
export const LEAD_STAGES: readonly ["new", "qualified", "proposal", "won", "lost"] = [
    "new",
    "qualified",
    "proposal",
    "won",
    "lost",
]

/** One stage of a lead. */
export type LeadStage = (typeof LEAD_STAGES)[number]

/** The stages in which a deal is still open. */
export const OPEN_STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal"]

/** The fewest characters a reason for closing a deal (won or lost) must have. */
export const MIN_REASON_CHARS = 5

/** The most characters the reason of a closed deal keeps. */
export const MAX_REASON_CHARS = 500

const KNOWN_STAGES: ReadonlyArray<string> = LEAD_STAGES

/** Whether a text names a stage. */
export const isLeadStage = (value: string): value is LeadStage => KNOWN_STAGES.includes(value)

/** Whether a deal in this stage is still open. */
export const isOpenStage = (stage: LeadStage): boolean => OPEN_STAGES.includes(stage)

/** Why a move was refused. */
export type MoveRefusal = "same_stage" | "stage_not_allowed" | "reopen_needs_owner" | "reason_required"

/** The outcome of asking to move a deal: the stage and closing reason to write, or why not. */
export type MovePlan =
    | { readonly kind: "move"; readonly stage: LeadStage; readonly closedReason: string | null }
    | { readonly kind: "refused"; readonly reason: MoveRefusal }

/**
 * Plans a move of a deal. An open deal goes to any other stage. A closed one switches to the other closed outcome only when the
 * settings let closed deals flip, and goes back to an open stage only with the owner's right when the settings ask for it.
 * Closing a deal (won or lost) takes a reason of at least `MIN_REASON_CHARS` characters, which is kept; a deal that stays open
 * keeps none.
 */
export const planMove = (
    from: LeadStage,
    to: LeadStage,
    reason: string | null,
    settings: SalesSettings,
    byOwner: boolean,
): MovePlan => {
    if (from === to) return { kind: "refused", reason: "same_stage" }
    if (!isOpenStage(from)) {
        if (isOpenStage(to) && settings.reopenNeedsApproval && !byOwner)
            return { kind: "refused", reason: "reopen_needs_owner" }
        if (!isOpenStage(to) && !settings.closedDealsCanFlip) return { kind: "refused", reason: "stage_not_allowed" }
    }
    if (isOpenStage(to)) return { kind: "move", stage: to, closedReason: null }
    const closedReason = (reason ?? "").trim()
    if (closedReason.length < MIN_REASON_CHARS) return { kind: "refused", reason: "reason_required" }
    return { kind: "move", stage: to, closedReason }
}

/**
 * The stage after what the sales AI learned of a deal: a closed deal stays closed, and the AI never wins a deal (a confirmed order
 * does); otherwise the stage it proposes, or the current one when it proposes none.
 */
export const classifiedStage = (current: LeadStage, proposed: LeadStage | null): LeadStage => {
    if (!isOpenStage(current) || proposed === "won") return current
    return proposed ?? current
}

/** The stage after an order of the customer is confirmed: won, unless the deal was lost. */
export const stageAfterConfirm = (current: LeadStage): LeadStage => (current === "lost" ? "lost" : "won")
