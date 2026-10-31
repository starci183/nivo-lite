import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the dossier-review capability. */
export enum DossierReviewErrorCode {
    /** The finding does not exist in this workspace. */
    FindingNotFound = "DOSSIER_REVIEW_FINDING_NOT_FOUND",
    /** The draft does not exist in this workspace. */
    DraftNotFound = "DOSSIER_REVIEW_DRAFT_NOT_FOUND",
    /** The finding or draft is not in a state that allows this move. */
    TransitionRefused = "DOSSIER_REVIEW_TRANSITION_REFUSED",
    /** A dismissal or a done mark needs a reason or a note. */
    ReasonRequired = "DOSSIER_REVIEW_REASON_REQUIRED",
    /** The assignee is not an active member of the workspace. */
    AssigneeNotMember = "DOSSIER_REVIEW_ASSIGNEE_NOT_MEMBER",
    /** The workspace asked for as many drafts as one day allows. */
    DraftDailyLimit = "DOSSIER_REVIEW_DRAFT_DAILY_LIMIT",
    /** The workspace has no such dossier to review. */
    NothingToReview = "DOSSIER_REVIEW_NOTHING_TO_REVIEW",
    /** The model could not answer; the job is retried. */
    ModelUnavailable = "DOSSIER_REVIEW_MODEL_UNAVAILABLE",
    /** The page size or the cursor of a findings list is not one this list hands out. */
    PageInvalid = "DOSSIER_REVIEW_PAGE_INVALID",
}

/** How each dossier-review code travels. */
export const DOSSIER_REVIEW_ERROR_KINDS: Record<DossierReviewErrorCode, ErrorKind> = {
    [DossierReviewErrorCode.FindingNotFound]: "not-found",
    [DossierReviewErrorCode.DraftNotFound]: "not-found",
    [DossierReviewErrorCode.TransitionRefused]: "conflict",
    [DossierReviewErrorCode.ReasonRequired]: "invalid",
    [DossierReviewErrorCode.AssigneeNotMember]: "invalid",
    [DossierReviewErrorCode.DraftDailyLimit]: "rate-limited",
    [DossierReviewErrorCode.NothingToReview]: "invalid",
    [DossierReviewErrorCode.ModelUnavailable]: "unavailable",
    [DossierReviewErrorCode.PageInvalid]: "invalid",
}

/** The one error class of the dossier-review capability. */
export class DossierReviewError extends DomainError<DossierReviewErrorCode> {}
