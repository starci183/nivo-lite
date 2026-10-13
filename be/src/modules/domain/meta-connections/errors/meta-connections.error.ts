import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the meta-connections capability. */
export enum MetaConnectionsErrorCode {
    /** The Meta app is not set up on this deployment. */
    NotConfigured = "META_CONNECTIONS_NOT_CONFIGURED",
    /** No Page is chosen yet. */
    NoPage = "META_CONNECTIONS_NO_PAGE",
    /** The Page is no longer in the list Meta gave. */
    PageGone = "META_CONNECTIONS_PAGE_GONE",
    /** The Page (or its Instagram account) is live in another connection. */
    PageInUse = "META_CONNECTIONS_PAGE_IN_USE",
    /** Meta refused NIVO access. */
    TokenRefused = "META_CONNECTIONS_TOKEN_REFUSED",
    /** Meta did not allow the operation. */
    PermissionRefused = "META_CONNECTIONS_PERMISSION_REFUSED",
    /** Meta is limiting requests. */
    RateLimited = "META_CONNECTIONS_RATE_LIMITED",
    /** Meta could not be reached. */
    Network = "META_CONNECTIONS_NETWORK",
    /** Meta failed in a way that has no more specific code. */
    Failed = "META_CONNECTIONS_FAILED",
}

/** How each meta-connections code travels. */
export const META_CONNECTIONS_ERROR_KINDS: Record<MetaConnectionsErrorCode, ErrorKind> = {
    [MetaConnectionsErrorCode.NotConfigured]: "unavailable",
    [MetaConnectionsErrorCode.NoPage]: "invalid",
    [MetaConnectionsErrorCode.PageGone]: "invalid",
    [MetaConnectionsErrorCode.PageInUse]: "conflict",
    [MetaConnectionsErrorCode.TokenRefused]: "invalid",
    [MetaConnectionsErrorCode.PermissionRefused]: "invalid",
    [MetaConnectionsErrorCode.RateLimited]: "rate-limited",
    [MetaConnectionsErrorCode.Network]: "unavailable",
    [MetaConnectionsErrorCode.Failed]: "internal",
}

/** The one error class of the meta-connections capability. */
export class MetaConnectionsError extends DomainError<MetaConnectionsErrorCode> {}
