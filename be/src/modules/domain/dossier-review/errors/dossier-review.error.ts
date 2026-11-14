import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the shop-document critic of the Second Brain. */
export enum DossierReviewErrorCode {
    /** The point of the document critique, or the document, does not exist in this workspace. */
    CriticNotFound = "DOSSIER_REVIEW_CRITIC_NOT_FOUND",
    /** The point was already answered, skipped, or left the document. */
    CriticDecided = "DOSSIER_REVIEW_CRITIC_DECIDED",
    /** The answer is not one the point offers, or it needs a value. */
    CriticAnswerInvalid = "DOSSIER_REVIEW_CRITIC_ANSWER_INVALID",
    /** The critique of the document is running; ask again when it ends. */
    CriticRunning = "DOSSIER_REVIEW_CRITIC_RUNNING",
}

/** How each critic code travels. */
export const DOSSIER_REVIEW_ERROR_KINDS: Record<DossierReviewErrorCode, ErrorKind> = {
    [DossierReviewErrorCode.CriticNotFound]: "not-found",
    [DossierReviewErrorCode.CriticDecided]: "conflict",
    [DossierReviewErrorCode.CriticAnswerInvalid]: "invalid",
    [DossierReviewErrorCode.CriticRunning]: "conflict",
}

/** The one error class of the shop-document critic. */
export class DossierReviewError extends DomainError<DossierReviewErrorCode> {}
