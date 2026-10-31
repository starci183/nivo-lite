import type { DataSlot } from "./slot"

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
    | "google_drive"

/** The provider's mode: test money is not real and NIVO books none of it, live is real. */
export type Environment = "test" | "live"

/** What the console does with a provider: which wizard sets it up. */
export type ProviderKind = "money" | "telegram" | "zalo" | "meta" | "webhook" | "google" | "drive" | "email" | "data"

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
type ProviderGroupId = "money" | "chat" | "data" | "tools"

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

/** The tone of a status mark on a provider page. */
export type ConnectionTone = "success" | "danger" | "warning" | "neutral" | "accent"

/** The header of a provider page: the connection, its status chip and the facts line. */
export interface ConnectionHeadView {
    readonly name: string
    readonly chipLabel: string
    readonly chipTone: ConnectionTone
    readonly facts: string
}

/** One labelled fact: a health tile of a provider page, with the line under its figure. */
export interface ConnectionFactView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta?: string
}

/** One line of a provider page list (a check, an event, a file being read): a title, the line under it and a verdict badge. */
export interface ConnectionLineView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: { readonly label: string; readonly tone: ConnectionTone; readonly isDot?: boolean }
    /** A command on the line (retry a failed file); absent on most lines. */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** One notice under the header of a provider page: why the connection cannot work, a refused command, or the one step left. */
export interface ConnectionNotice {
    readonly id: string
    readonly tone: "negative" | "cautionary" | "informative" | "affirmative"
    readonly title: string
    readonly description?: string
    /** A command beside the notice (read the page again when it could not be read). */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** One agent of the workspace and whether it works through the connection. */
export interface ConnectionAgentRowView {
    readonly id: string
    readonly name: string
    readonly isOn: boolean
}

/** One step of the trail above a provider page. */
interface ConnectionCrumb {
    readonly id: string
    readonly label: string
    readonly href?: string
}

/** The live rail of a provider page, beside the main pane (a drawer on a narrow screen). */
interface ConnectionRailView {
    readonly label: string
    readonly openLabel: string
    readonly closeLabel: string
    readonly isOpen: boolean
}

/** The frame of a provider page: the header, the trail, the notices, the owner's disconnect and its question. */
export interface ConnectionPageHeadView {
    /** The connection's name, status and facts once read; absent while it loads or when it could not be read (a notice then says why). */
    readonly head?: ConnectionHeadView
    readonly isSkeleton: boolean
    readonly icon: "chat" | "apps"
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<ConnectionCrumb>
    readonly gridLabel: string
    readonly mainLabel: string
    readonly rail: ConnectionRailView
    /** The one command of the header band (check again, grant again); absent when the page has none. */
    readonly action?: { readonly label: string; readonly intent: "commit" | "neutral"; readonly isPending: boolean }
    readonly notices: ReadonlyArray<ConnectionNotice>
    /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
    readonly disconnect?: { readonly title: string; readonly description: string; readonly label: string }
    readonly confirm: {
        readonly isOpen: boolean
        readonly title: string
        readonly description: string
        readonly confirmLabel: string
        readonly cancelLabel: string
        readonly isPending: boolean
    }
}

/** What the frame of a provider page can be told to do. */
export interface ConnectionPageHeadCommands {
    readonly act: () => void
    readonly askDisconnect: () => void
    readonly confirmDisconnect: () => void
    readonly dismiss: () => void
    readonly openRail: (isOpen: boolean) => void
    readonly retry: () => void
}

/** The health tiles of a provider page, with the sentence for when there is nothing to show. */
export interface ConnectionTilesView {
    readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
    readonly emptyLabel: string
    readonly retry: () => void
}

/** The live rail of a provider page: its heading, the lines, and how it keeps itself current. */
export interface ConnectionRailLinesView {
    readonly title: string
    readonly liveLabel: string
    readonly footnote: string
    readonly emptyLabel: string
    readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
    readonly retry: () => void
}
