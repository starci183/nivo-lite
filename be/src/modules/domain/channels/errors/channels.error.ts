import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the channels capability. */
export enum ChannelsErrorCode {
    /** The connection does not exist, is disconnected, belongs to another workspace or is not of the expected provider. */
    ConnectionNotFound = "CHANNELS_CONNECTION_NOT_FOUND",
    /** The stored credential could not be read as the provider's document. */
    SecretUnreadable = "CHANNELS_SECRET_UNREADABLE",
    /** The Zalo connection holds no tokens yet: the owner must authorize first. */
    ZaloNotAuthorized = "CHANNELS_ZALO_NOT_AUTHORIZED",
    /** Another worker is refreshing the same Zalo tokens; try again shortly. */
    ZaloRefreshBusy = "CHANNELS_ZALO_REFRESH_BUSY",
    /** The authorization return carries a state that does not match a started authorization. */
    ZaloStateRejected = "CHANNELS_ZALO_STATE_REJECTED",
    /** The started authorization is older than its allowed time. */
    ZaloStateExpired = "CHANNELS_ZALO_STATE_EXPIRED",
}

/** How each channels code travels. */
export const CHANNELS_ERROR_KINDS: Record<ChannelsErrorCode, ErrorKind> = {
    [ChannelsErrorCode.ConnectionNotFound]: "not-found",
    [ChannelsErrorCode.SecretUnreadable]: "internal",
    [ChannelsErrorCode.ZaloNotAuthorized]: "invalid",
    [ChannelsErrorCode.ZaloRefreshBusy]: "unavailable",
    [ChannelsErrorCode.ZaloStateRejected]: "forbidden",
    [ChannelsErrorCode.ZaloStateExpired]: "conflict",
}

/** The one error class of the channels capability. */
export class ChannelsError extends DomainError<ChannelsErrorCode> {}
