import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the loyalty campaigns capability. */
export enum LoyaltyCampaignsErrorCode {
    /** No customer matches the segment, so there is nobody to send to. */
    NoRecipients = "LOYALTY_CAMPAIGNS_NO_RECIPIENTS",
    /** The insert answered no row: the campaign was not written. */
    NotCreated = "LOYALTY_CAMPAIGNS_NOT_CREATED",
    /** The campaign does not belong to the selected workspace or is gone. */
    NotFound = "LOYALTY_CAMPAIGNS_NOT_FOUND",
}

/** How each loyalty campaigns code travels. */
export const LOYALTY_CAMPAIGNS_ERROR_KINDS: Record<LoyaltyCampaignsErrorCode, ErrorKind> = {
    [LoyaltyCampaignsErrorCode.NoRecipients]: "invalid",
    [LoyaltyCampaignsErrorCode.NotCreated]: "internal",
    [LoyaltyCampaignsErrorCode.NotFound]: "not-found",
}

/** The one error class of the loyalty campaigns capability. */
export class LoyaltyCampaignsError extends DomainError<LoyaltyCampaignsErrorCode> {}
