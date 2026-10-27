import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the Zalo integration. A refusal Zalo explained carries its numeric error in the params as `zaloCode`. */
export enum ZaloErrorCode {
    /** Zalo could not be reached or did not answer in time. */
    Unavailable = "ZALO_UNAVAILABLE",
    /** Zalo answered and refused the call for a reason this integration does not classify further. */
    Rejected = "ZALO_REJECTED",
    /** A webhook body was not the JSON its mac covers. */
    BodyUnreadable = "ZALO_BODY_UNREADABLE",
    /** The consultation window is closed: the customer has not interacted with the OA recently enough. */
    WindowClosed = "ZALO_WINDOW_CLOSED",
    /** The customer does not follow the OA (any more). */
    NotFollower = "ZALO_NOT_FOLLOWER",
    /** Zalo does not deliver this message at night. */
    NightHours = "ZALO_NIGHT_HOURS",
    /** The OA access token is invalid or expired. */
    TokenRejected = "ZALO_TOKEN_REJECTED",
    /** The phone is not valid, has no Zalo account, or its owner does not take notifications. */
    RecipientUnreachable = "ZALO_RECIPIENT_UNREACHABLE",
    /** The ZNS template id is unknown or not approved, or its data does not fit the template. */
    TemplateRejected = "ZALO_TEMPLATE_REJECTED",
    /** The OA has spent its quota or its ZNS balance. */
    QuotaExhausted = "ZALO_QUOTA_EXHAUSTED",
    /** The OA or its app has no permission for this API (ZNS not enabled, development mode). */
    NotPermitted = "ZALO_NOT_PERMITTED",
}

/** How each Zalo code travels. */
export const ZALO_ERROR_KINDS: Record<ZaloErrorCode, ErrorKind> = {
    [ZaloErrorCode.Unavailable]: "unavailable",
    [ZaloErrorCode.Rejected]: "unavailable",
    [ZaloErrorCode.BodyUnreadable]: "invalid",
    [ZaloErrorCode.WindowClosed]: "conflict",
    [ZaloErrorCode.NotFollower]: "conflict",
    [ZaloErrorCode.NightHours]: "conflict",
    [ZaloErrorCode.TokenRejected]: "unauthenticated",
    [ZaloErrorCode.RecipientUnreachable]: "invalid",
    [ZaloErrorCode.TemplateRejected]: "invalid",
    [ZaloErrorCode.QuotaExhausted]: "rate-limited",
    [ZaloErrorCode.NotPermitted]: "forbidden",
}

/** The one error class of the Zalo integration. */
export class ZaloError extends DomainError<ZaloErrorCode> {}
