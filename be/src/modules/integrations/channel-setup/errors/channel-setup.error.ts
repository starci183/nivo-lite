import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the channel-setup integration. */
export enum ChannelSetupErrorCode {
    /** The provider did not accept the credential (Telegram answered 401 or 404 for the token). */
    CredentialRejected = "CHANNEL_SETUP_CREDENTIAL_REJECTED",
    /** The provider could not be reached or did not answer in time. */
    Unreachable = "CHANNEL_SETUP_UNREACHABLE",
    /** The provider answered with a refusal that is not a rejected credential (for example a webhook address it will not use). */
    Refused = "CHANNEL_SETUP_REFUSED",
    /** The Zalo authorization cannot be built because the app is not configured with a site url. */
    NotConfigured = "CHANNEL_SETUP_NOT_CONFIGURED",
}

/** How each channel-setup code travels. */
export const CHANNEL_SETUP_ERROR_KINDS: Record<ChannelSetupErrorCode, ErrorKind> = {
    [ChannelSetupErrorCode.CredentialRejected]: "invalid",
    [ChannelSetupErrorCode.Unreachable]: "unavailable",
    [ChannelSetupErrorCode.Refused]: "invalid",
    [ChannelSetupErrorCode.NotConfigured]: "unavailable",
}

/** The one error class of the channel-setup integration. */
export class ChannelSetupError extends DomainError<ChannelSetupErrorCode> {}
