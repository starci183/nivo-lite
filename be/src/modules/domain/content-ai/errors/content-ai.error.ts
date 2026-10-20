import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable codes returned by content AI operations. */
export enum ContentAiErrorCode {
    /** Reports that this operation cannot proceed with the selected state. */
    InvalidInput = "CONTENT_AI_INVALID_INPUT",
    /** Reports that this operation cannot proceed with the selected state. */
    DraftingBlocked = "CONTENT_AI_DRAFTING_BLOCKED",
    /** Reports that this operation cannot proceed with the selected state. */
    NoPillars = "CONTENT_AI_NO_PILLARS",
    /** Reports that this operation cannot proceed with the selected state. */
    NoCadence = "CONTENT_AI_NO_CADENCE",
    /** Reports that this operation cannot proceed with the selected state. */
    NoSlots = "CONTENT_AI_NO_SLOTS",
    /** Reports that this operation cannot proceed with the selected state. */
    InvalidAnswer = "CONTENT_AI_INVALID_ANSWER",
    /** Reports that this operation cannot proceed with the selected state. */
    EmptyAnswer = "CONTENT_AI_EMPTY_ANSWER",
    /** Reports that this operation cannot proceed with the selected state. */
    NotFound = "CONTENT_AI_NOT_FOUND",
    /** Reports that this operation cannot proceed with the selected state. */
    Failed = "CONTENT_AI_FAILED",
    /** The attached file is not a readable PDF of at most 20 MB. */
    FileInvalid = "CONTENT_AI_FILE_INVALID",
    /** The model could not read a brand kit from the file. */
    BrandUnreadable = "CONTENT_AI_BRAND_UNREADABLE",
    /** No such brand proposal in this workspace. */
    ProposalNotFound = "CONTENT_AI_PROPOSAL_NOT_FOUND",
    /** The brand proposal was decided already. */
    ProposalDecided = "CONTENT_AI_PROPOSAL_DECIDED",
    /** The edited kit has no color and no tone. */
    KitInvalid = "CONTENT_AI_KIT_INVALID",
    /** A network refused to schedule a post; the `reason` param says why. */
    ChannelRefused = "CONTENT_AI_CHANNEL_REFUSED",
}

/** Error classification carried by GraphQL. */
export const CONTENT_AI_ERROR_KINDS: Record<ContentAiErrorCode, ErrorKind> = {
    [ContentAiErrorCode.InvalidInput]: "invalid",
    [ContentAiErrorCode.DraftingBlocked]: "forbidden",
    [ContentAiErrorCode.NoPillars]: "invalid",
    [ContentAiErrorCode.NoCadence]: "invalid",
    [ContentAiErrorCode.NoSlots]: "invalid",
    [ContentAiErrorCode.InvalidAnswer]: "unavailable",
    [ContentAiErrorCode.EmptyAnswer]: "unavailable",
    [ContentAiErrorCode.NotFound]: "not-found",
    [ContentAiErrorCode.Failed]: "unavailable",
    [ContentAiErrorCode.FileInvalid]: "invalid",
    [ContentAiErrorCode.BrandUnreadable]: "unavailable",
    [ContentAiErrorCode.ProposalNotFound]: "not-found",
    [ContentAiErrorCode.ProposalDecided]: "conflict",
    [ContentAiErrorCode.KitInvalid]: "invalid",
    [ContentAiErrorCode.ChannelRefused]: "unavailable",
}

/** The content AI capability's typed failure. */
export class ContentAiError extends DomainError<ContentAiErrorCode> {}
