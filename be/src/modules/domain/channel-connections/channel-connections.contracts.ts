import type { ZaloSetupSecret } from "@modules/integrations/channel-setup"
import type { ConnectionRecord, Environment, FirstEvent, ConnectionStatus, Provider } from "@modules/domain/connections"

/** The bank and payment feeds a wizard can create. */
export type MoneyProvider = "sepay" | "payos" | "casso"

/** What starting a Telegram connection takes. */
export interface TelegramStart {
    /** The name the owner gives the connection. */
    readonly name: string
    /** The bot token from @BotFather. */
    readonly token: string
}

/** What a Telegram connection answers. */
export interface TelegramConnected {
    /** The new connection. */
    readonly connection: ConnectionRecord
    /** The bot username, when BotFather returned one. */
    readonly botUsername: string | null
    /** A bank feed fact; a Telegram connection has none. */
    readonly accountMasked: string | null
    /** False on a local site, where the webhook is registered later on the real domain. */
    readonly webhookRegistered: boolean
}

/** The SePay key and the webhook address the owner pastes into SePay. */
export interface SepayKeyReveal {
    /** The API key. */
    readonly apiKey: string
    /** The webhook address of this connection. */
    readonly webhookUrl: string
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
    /** The full account number, 6 to 20 digits once spaces are removed (required by bank feeds, ignored by payOS). */
    readonly accountNumber?: string | undefined
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
    /** A new account number, 6 to 20 digits; blank or omitted keeps the stored one. */
    readonly accountNumber?: string | undefined
    /** The account holder (bank feeds). */
    readonly holder: string
    /** SePay: the API key NIVO generated or the one typed into SePay. */
    readonly apiKey?: string | undefined
}

/** The wizard view of a bank or payment feed. */
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
    /** SePay only: the API key in clear in the answer that creates the connection (to paste into SePay once), masked to its last 4 characters everywhere else; empty for the others. */
    readonly apiKey: string
    /** The bank code. */
    readonly bankCode: string
    /** The human name of the bank, or the upper-cased code when the bank is not listed. */
    readonly bank: string
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
    readonly clientId?: string
    /** payOS API key. */
    readonly apiKey?: string
    /** payOS checksum key. */
    readonly checksumKey?: string
    /** Casso secure key. */
    readonly secureKey?: string
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

/** What connecting a bot again in its existing row sets. */
export interface TelegramReconnect {
    /** The name of the connection. */
    readonly name: string
    /** The bot facts: its id and username. */
    readonly meta: Readonly<Record<string, string>>
    /** The bot token, sealed on write. */
    readonly token: string
    /** The new webhook secret. */
    readonly secret: string
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

/** The bank account a workspace is paid into, read from its own bank feed: enough to draw a VietQR for it. */
export interface WorkspacePaymentAccount {
    /** The full account number, digits only. */
    readonly accountNumber: string
    /** The short bank code as VietQR lists it. */
    readonly bankCode: string
    /** The account holder, or null when the feed has none. */
    readonly holder: string | null
    /** The feed the account comes from (sepay or casso). */
    readonly provider: string
}

/** The account a VietQR is drawn for. */
export interface VietQrAccount {
    /** The full account number. */
    readonly accountNumber: string
    /** The short bank code as VietQR lists it. */
    readonly bankCode: string
    /** The account holder; the image does not print it. */
    readonly holder?: string | null
}

/** A workspace payment account, or null when no bank feed of the workspace stores a full account number. */
export type OptionalWorkspacePaymentAccount = WorkspacePaymentAccount | null

/** An amount in VND for a VietQR, or null when the payer types it. */
export type OptionalQrAmount = number | null

/** The Zalo credential read from a sealed secret, or null when the text is not one. */
export type OptionalZaloSecret = ZaloSetupSecret | null
