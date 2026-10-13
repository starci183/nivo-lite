import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Refusals of the publishing gate and manually supplied proof. */
export enum ContentPublishingErrorCode {
    /** Ideas must be drafted before submission. */
    NotDrafted = "CONTENT_PUBLISHING_NOT_DRAFTED",
    /** The content item no longer permits this action. */
    WrongStatus = "CONTENT_PUBLISHING_WRONG_STATUS",
    /** Every selected channel needs a nonempty draft. */
    TextMissing = "CONTENT_PUBLISHING_TEXT_MISSING",
    /** The policy gate could not accept the submission. */
    GateFailed = "CONTENT_PUBLISHING_GATE_FAILED",
    /** The publication channel does not belong to the post. */
    ChannelInvalid = "CONTENT_PUBLISHING_CHANNEL_INVALID",
    /** The supplied proof link must use HTTP or HTTPS. */
    UrlInvalid = "CONTENT_PUBLISHING_URL_INVALID",
}

/** Stable transport kinds of publishing refusals. */
export const CONTENT_PUBLISHING_ERROR_KINDS: Record<ContentPublishingErrorCode, ErrorKind> = {
    [ContentPublishingErrorCode.NotDrafted]: "invalid",
    [ContentPublishingErrorCode.WrongStatus]: "conflict",
    [ContentPublishingErrorCode.TextMissing]: "invalid",
    [ContentPublishingErrorCode.GateFailed]: "unavailable",
    [ContentPublishingErrorCode.ChannelInvalid]: "invalid",
    [ContentPublishingErrorCode.UrlInvalid]: "invalid",
}

/** One domain error class for publishing refusals. */
export class ContentPublishingError extends DomainError<ContentPublishingErrorCode> {}
