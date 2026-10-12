import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the channel-connections capability. */
export enum ChannelConnectionsErrorCode {
    /** The text is not shaped like a Telegram bot token. */
    TokenFormat = "CHANNEL_CONNECTIONS_TOKEN_FORMAT",
    /** Telegram does not accept the token. */
    TokenRejected = "CHANNEL_CONNECTIONS_TOKEN_REJECTED",
    /** The provider could not be reached. */
    Network = "CHANNEL_CONNECTIONS_NETWORK",
    /** The bot is already live in a connection (of this or another workspace). */
    BotInUse = "CHANNEL_CONNECTIONS_BOT_IN_USE",
    /** The token is valid but Telegram refused the webhook address. */
    WebhookRefused = "CHANNEL_CONNECTIONS_WEBHOOK_REFUSED",
    /** The bank account number is not 6 to 20 digits. */
    AccountInvalid = "CHANNEL_CONNECTIONS_ACCOUNT_INVALID",
    /** The bank code or the account holder is missing. */
    BankFieldsMissing = "CHANNEL_CONNECTIONS_BANK_FIELDS_MISSING",
    /** The SePay API key is not 16 to 128 letters, digits, dashes or underscores. */
    ApiKeyInvalid = "CHANNEL_CONNECTIONS_API_KEY_INVALID",
    /** A provider key is missing, too short or too long. */
    KeysInvalid = "CHANNEL_CONNECTIONS_KEYS_INVALID",
    /** payOS did not confirm the webhook address. */
    PayosConfirmRefused = "CHANNEL_CONNECTIONS_PAYOS_CONFIRM_REFUSED",
    /** The Zalo app id or secret is missing or malformed. */
    ZaloFieldsInvalid = "CHANNEL_CONNECTIONS_ZALO_FIELDS_INVALID",
    /** The stored Zalo tokens are missing or no longer usable. */
    ZaloTokenRefused = "CHANNEL_CONNECTIONS_ZALO_TOKEN_REFUSED",
    /** The connection is not of the provider the operation is for. */
    ProviderUnsupported = "CHANNEL_CONNECTIONS_PROVIDER_UNSUPPORTED",
    /** The provider failed in a way that has no more specific code. */
    Failed = "CHANNEL_CONNECTIONS_FAILED",
}

/** How each channel-connections code travels. */
export const CHANNEL_CONNECTIONS_ERROR_KINDS: Record<ChannelConnectionsErrorCode, ErrorKind> = {
    [ChannelConnectionsErrorCode.TokenFormat]: "invalid",
    [ChannelConnectionsErrorCode.TokenRejected]: "invalid",
    [ChannelConnectionsErrorCode.Network]: "unavailable",
    [ChannelConnectionsErrorCode.BotInUse]: "conflict",
    [ChannelConnectionsErrorCode.WebhookRefused]: "unavailable",
    [ChannelConnectionsErrorCode.AccountInvalid]: "invalid",
    [ChannelConnectionsErrorCode.BankFieldsMissing]: "invalid",
    [ChannelConnectionsErrorCode.ApiKeyInvalid]: "invalid",
    [ChannelConnectionsErrorCode.KeysInvalid]: "invalid",
    [ChannelConnectionsErrorCode.PayosConfirmRefused]: "unavailable",
    [ChannelConnectionsErrorCode.ZaloFieldsInvalid]: "invalid",
    [ChannelConnectionsErrorCode.ZaloTokenRefused]: "unavailable",
    [ChannelConnectionsErrorCode.ProviderUnsupported]: "invalid",
    [ChannelConnectionsErrorCode.Failed]: "internal",
}

/** The one error class of the channel-connections capability. */
export class ChannelConnectionsError extends DomainError<ChannelConnectionsErrorCode> {}
