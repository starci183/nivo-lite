import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the template-marketplace capability. */
export enum TemplateMarketplaceErrorCode {
    /** No listing has this id. */
    ListingNotFound = "TEMPLATE_MARKETPLACE_LISTING_NOT_FOUND",
    /** The template belongs to another account. */
    NotYours = "TEMPLATE_MARKETPLACE_NOT_YOURS",
    /** The listing is not in a state that allows this step. */
    BadTransition = "TEMPLATE_MARKETPLACE_BAD_TRANSITION",
    /** An automated check failed, so the listing cannot be approved. */
    ChecksFailed = "TEMPLATE_MARKETPLACE_CHECKS_FAILED",
    /** The persona of a real person has no valid consent. */
    ConsentMissing = "TEMPLATE_MARKETPLACE_CONSENT_MISSING",
    /** The listing is not approved, so nobody can take it. */
    NotAvailable = "TEMPLATE_MARKETPLACE_NOT_AVAILABLE",
    /** The listing costs money and the workspace has not paid for it. */
    PaymentRequired = "TEMPLATE_MARKETPLACE_PAYMENT_REQUIRED",
    /** The listing is free; there is nothing to pay. */
    NothingToPay = "TEMPLATE_MARKETPLACE_NOTHING_TO_PAY",
    /** The price is not a whole amount of dong, or is negative. */
    PriceInvalid = "TEMPLATE_MARKETPLACE_PRICE_INVALID",
    /** The installation was not made from a template. */
    NotATemplateInstall = "TEMPLATE_MARKETPLACE_NOT_A_TEMPLATE_INSTALL",
    /** The update has no such unit, or no newer version. */
    UpdateUnavailable = "TEMPLATE_MARKETPLACE_UPDATE_UNAVAILABLE",
    /** Only a first-party package can be forked, under a key of the right shape. */
    ForkNotAllowed = "TEMPLATE_MARKETPLACE_FORK_NOT_ALLOWED",
    /** The consent record is not found. */
    GrantNotFound = "TEMPLATE_MARKETPLACE_GRANT_NOT_FOUND",
}

/** How each template-marketplace code travels. */
export const TEMPLATE_MARKETPLACE_ERROR_KINDS: Record<TemplateMarketplaceErrorCode, ErrorKind> = {
    [TemplateMarketplaceErrorCode.ListingNotFound]: "not-found",
    [TemplateMarketplaceErrorCode.NotYours]: "forbidden",
    [TemplateMarketplaceErrorCode.BadTransition]: "conflict",
    [TemplateMarketplaceErrorCode.ChecksFailed]: "invalid",
    [TemplateMarketplaceErrorCode.ConsentMissing]: "invalid",
    [TemplateMarketplaceErrorCode.NotAvailable]: "not-found",
    [TemplateMarketplaceErrorCode.PaymentRequired]: "forbidden",
    [TemplateMarketplaceErrorCode.NothingToPay]: "invalid",
    [TemplateMarketplaceErrorCode.PriceInvalid]: "invalid",
    [TemplateMarketplaceErrorCode.NotATemplateInstall]: "not-found",
    [TemplateMarketplaceErrorCode.UpdateUnavailable]: "conflict",
    [TemplateMarketplaceErrorCode.ForkNotAllowed]: "invalid",
    [TemplateMarketplaceErrorCode.GrantNotFound]: "not-found",
}

/** The one error class of the template-marketplace capability. */
export class TemplateMarketplaceError extends DomainError<TemplateMarketplaceErrorCode> {}
