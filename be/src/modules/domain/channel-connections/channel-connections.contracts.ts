import type { ConnectionRecord, Environment, FirstEvent, ConnectionStatus, Provider } from "@modules/domain/connections"

/** The bank and payment feeds a wizard can create. */
export type MoneyProvider = "sepay" | "payos" | "casso"

/** What starting a Telegram connection takes. */
export interface ConnectTelegramInput {
    /** The name the owner gives the connection. */
    readonly name: string
    /** The bot token from @BotFather. */
    readonly token: string
}

/** What a Telegram connection answers. */
export interface TelegramConnected {
    /** The new connection. */
    readonly connection: ConnectionRecord
    /** False on a local site, where the webhook is registered later on the real domain. */
    readonly webhookRegistered: boolean
}

/** What starting a bank or payment feed takes. */
export interface StartMoneyInput {
    /** Which feed. */
    readonly provider: string
    /** Test or live; a provider without a test mode stays live. */
    readonly environment: string
    /** The name the owner gives the connection. */
    readonly name: string
    /** The bank code (bank feeds). */
    readonly bankCode: string
    /** The account number (bank feeds). */
    readonly accountNumber: string
    /** The account holder (bank feeds). */
    readonly holder: string
}

/** What editing a bank or payment feed takes. */
export interface UpdateMoneyInput {
    /** Test or live. */
    readonly environment: string
    /** The name. */
    readonly name: string
    /** The bank code (bank feeds). */
    readonly bankCode: string
    /** A new account number; blank keeps the stored one. */
    readonly accountNumber: string
    /** The account holder (bank feeds). */
    readonly holder: string
    /** SePay: the API key NIVO generated or the one typed into SePay. */
    readonly apiKey?: string | undefined
}

/** The wizard view of a bank or payment feed; the bank display name is derived from `bankCode` by the caller. */
export interface WizardConnection {
    /** The id of the connection. */
    readonly id: string
    /** The provider. */
    readonly provider: Provider
    /** The name. */
    readonly name: string
    /** Test or live. */
    readonly environment: Environment
    /** The status. */
    readonly status: ConnectionStatus
    /** The address the provider must call. */
    readonly webhookUrl: string
    /** SePay only: the API key to paste into SePay (empty for the others and when not asked for). */
    readonly apiKey: string
    /** The bank code. */
    readonly bankCode: string
    /** The masked account number. */
    readonly account: string
    /** The account holder. */
    readonly holder: string
    /** Whether the provider keys were saved. */
    readonly credentialsSaved: boolean
    /** The first event the feed accepted. */
    readonly firstEvent: FirstEvent | null
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}

/** The keys a payOS or Casso connection stores, by name; the ones the provider does not use stay absent. */
export interface ProviderKeyValues {
    /** payOS client id. */
    readonly clientId?: string | undefined
    /** payOS API key. */
    readonly apiKey?: string | undefined
    /** payOS checksum key. */
    readonly checksumKey?: string | undefined
    /** Casso secure key. */
    readonly secureKey?: string | undefined
}

/** What saving provider keys answers. */
export interface ProviderKeysResult {
    /** Whether payOS confirmed the webhook address. */
    readonly confirmed: boolean
    /** True on a local site, where the confirmation is skipped. */
    readonly localOnly: boolean
}

/** What starting a Zalo connection takes. */
export interface StartZaloInput {
    /** The name the owner gives the connection. */
    readonly name: string
    /** The Zalo app id. */
    readonly appId: string
    /** The Zalo app secret. */
    readonly appSecret: string
}

/** The wizard view of a Zalo connection; the keys are never returned. */
export interface ZaloWizardConnection {
    /** The id of the connection. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: ConnectionStatus
    /** The webhook address to register on the Zalo app. */
    readonly webhookUrl: string
    /** The callback address to register on the Zalo app. */
    readonly callbackUrl: string
    /** The OA has been authorized (NIVO holds tokens). */
    readonly authorized: boolean
    /** The OA secret key was saved. */
    readonly oaSecretSaved: boolean
    /** The Official Account id. */
    readonly oaId: string
    /** The first event the connection accepted. */
    readonly firstEvent: FirstEvent | null
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}

/** What asking a provider about a connection answers. */
export interface ConnectionCheck {
    /** The provider. */
    readonly provider: Provider
    /** Telegram: Telegram knows our webhook address. Other providers: false. */
    readonly webhookOk: boolean
    /** True when the site is not public, so providers cannot call it. */
    readonly localOnly: boolean
    /** Updates Telegram holds for us. */
    readonly pending: number
    /** The last delivery error the provider reported. */
    readonly lastError: string | null
}
