import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the loyalty capability. */
export enum LoyaltyErrorCode {
    /** The workspace has no customer with the id. */
    MemberNotFound = "LOYALTY_MEMBER_NOT_FOUND",
    /** The reward is not in the catalogue of the workspace. */
    RewardNotFound = "LOYALTY_REWARD_NOT_FOUND",
    /** The customer cannot redeem the reward now; `params.reason` says why. */
    NotRedeemable = "LOYALTY_NOT_REDEEMABLE",
    /** An adjustment of zero points moves nothing. */
    PointsRequired = "LOYALTY_POINTS_REQUIRED",
    /** An adjustment needs the reason the owner gives. */
    ReasonRequired = "LOYALTY_REASON_REQUIRED",
    /** The phone is not a Vietnamese phone number. */
    PhoneInvalid = "LOYALTY_PHONE_INVALID",
    /** The amount of a sale is not a positive number. */
    AmountInvalid = "LOYALTY_AMOUNT_INVALID",
    /** A redemption names neither a phone nor a customer. */
    ContactRequired = "LOYALTY_CONTACT_REQUIRED",
    /** No customer could be made for the sale. */
    CustomerNotCreated = "LOYALTY_CUSTOMER_NOT_CREATED",
    /** The loyalty module is not installed, is paused or the programme is off. */
    ProgramOff = "LOYALTY_PROGRAM_OFF",
    /** No switched-on programme has the slug. */
    PageNotFound = "LOYALTY_PAGE_NOT_FOUND",
}

/** How each loyalty code travels. */
export const LOYALTY_ERROR_KINDS: Record<LoyaltyErrorCode, ErrorKind> = {
    [LoyaltyErrorCode.MemberNotFound]: "not-found",
    [LoyaltyErrorCode.RewardNotFound]: "not-found",
    [LoyaltyErrorCode.NotRedeemable]: "invalid",
    [LoyaltyErrorCode.PointsRequired]: "invalid",
    [LoyaltyErrorCode.ReasonRequired]: "invalid",
    [LoyaltyErrorCode.PhoneInvalid]: "invalid",
    [LoyaltyErrorCode.AmountInvalid]: "invalid",
    [LoyaltyErrorCode.ContactRequired]: "invalid",
    [LoyaltyErrorCode.CustomerNotCreated]: "invalid",
    [LoyaltyErrorCode.ProgramOff]: "conflict",
    [LoyaltyErrorCode.PageNotFound]: "not-found",
}

/** The one error class of the loyalty capability. */
export class LoyaltyError extends DomainError<LoyaltyErrorCode> {}
