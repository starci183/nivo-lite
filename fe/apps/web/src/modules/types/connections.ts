/** Every provider a workspace can connect. */
export type Provider =
    | "telegram"
    | "sepay"
    | "zalo_oa"
    | "payos"
    | "casso"
    | "webhook"
    | "google"
    | "smtp"
    | "openapi"
    | "database"
    | "csv_import"
    | "imap"
    | "telegram_user"
    | "meta"

/** The provider's mode: test money is not real and NIVO books none of it, live is real. */
export type Environment = "test" | "live"

/** What the console does with a provider: which wizard sets it up. */
export type ProviderKind = "money" | "telegram" | "zalo" | "meta" | "webhook" | "google" | "email" | "data"

/** `pending`: created by the wizard but no first event yet (or the wizard was abandoned). */
export type ConnectionStatus = "pending" | "connected" | "error" | "disconnected"

/** What an agent may do through one connection. */
export type Access = "read" | "ask" | "auto"

/** How an agent uses a connection (stored on the grant). */
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

/** The first event a connection accepted. */
export interface FirstEvent {
    readonly amount: number
    readonly content: string
    readonly at: string
}

/** One agent's access to one connection. */
export interface ConnectionGrant {
    readonly agentId: string
    readonly access: Access
}

/** One workspace connection as the console shows it (non-secret facts only). */
export interface Connection {
    readonly id: string
    readonly workspaceId: string
    readonly provider: Provider
    readonly name: string
    /** Non-secret facts: bot_username, bank_code, account_masked, oa_id, app_id and so on. */
    readonly meta: Readonly<Record<string, string>>
    readonly status: ConnectionStatus
    readonly lastError: string | null
    readonly environment: Environment
    /** SMTP only: the workspace default sender. */
    readonly isDefault: boolean
    readonly lastEventAt: string | null
    readonly firstEvent: FirstEvent | null
    /** Ids of the agents that use this connection. */
    readonly agentIds: ReadonlyArray<string>
    /** Each agent's access level through this connection (same agents as agentIds). */
    readonly grants: ReadonlyArray<ConnectionGrant>
}

/** An agent a connection can be attached to. */
export interface AgentOption {
    readonly id: string
    readonly name: string
    readonly module: string
}

/** The Connections page groups providers by what they bring in. */
export type ProviderGroupId = "money" | "chat" | "data" | "tools"

/** One group of the page: its id and the providers inside, in display order. */
export interface ProviderGroup {
    readonly id: ProviderGroupId
    readonly providers: ReadonlyArray<Provider>
}

/** The library's categories. */
export type ConnectorCategory =
    "payments" | "chat" | "commerce" | "accounting" | "data" | "email" | "productivity" | "automation"

/** official: built and proven; early: built from public docs; soon: planned, not connectable yet. */
export type ConnectorStatus = "official" | "early" | "soon"

/** Which agents a connector is for ("any": every agent may read it, given access). */
export type ConnectorAudience = "chatbot" | "sales" | "accounting" | "any"

/** Glyph of a connector without its own logo. */
export type ConnectorGlyph = "wallet" | "community" | "cart" | "servers" | "email" | "apps" | "trigger" | "code"

/** What a first-event poll answers. */
export interface FirstEventState {
    readonly status: ConnectionStatus
    readonly firstEvent: FirstEvent | null
}

/** What a Telegram or Zalo check answers. */
export interface ConnectionCheck {
    readonly provider: Provider
    /** Telegram: Telegram knows our webhook URL. Other providers: always false. */
    readonly webhookOk: boolean
    readonly localOnly: boolean
    readonly pending: number
    readonly lastError: string | null
}

/** What the Meta check answers (the row shows a short verdict). */
export interface MetaCheckSummary {
    readonly ok: boolean
    readonly tokenOk: boolean
    readonly page: { readonly fields: ReadonlyArray<string> }
}

/** What a signed webhook test answers. */
export interface WebhookTestVerdict {
    readonly ok: boolean
    readonly status: number | null
    readonly error: string | null
    readonly durationMs: number
}

/** The SePay URL and key the owner pastes into SePay. */
export interface SepayKeys {
    readonly apiKey: string
    readonly webhookUrl: string
}

/** The Google consent page the owner is sent to. */
export interface GoogleConsent {
    readonly url: string
}
