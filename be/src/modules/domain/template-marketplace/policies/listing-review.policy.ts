import type { ListingStatus } from "../template-marketplace.contracts"

/** A step of the review of a listing. */
export type ReviewAction = "submit" | "approve" | "reject"

/**
 * The review state machine: a draft or a rejected listing is submitted, and a submit whose automated checks fail stays a draft; only a
 * submitted listing is approved or rejected, and an approved listing is final (a fix is a new version with its own listing). Null when
 * the step is not allowed from the state.
 */
export const nextStatus = (status: ListingStatus, action: ReviewAction, checksPass: boolean): ListingStatus | null => {
    if (action === "submit") {
        if (status !== "draft" && status !== "rejected") return null
        return checksPass ? "submitted" : "draft"
    }
    if (status !== "submitted") return null
    return action === "approve" ? "approved" : "rejected"
}
