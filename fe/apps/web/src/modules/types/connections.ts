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
    /** The value is words, not a figure: it draws in a text style, never the large face of a key figure. */
    readonly isText?: boolean
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

/** The live rail of a provider page: its heading, the lines, and how it keeps itself current. */
export interface ConnectionRailLinesView {
    readonly title: string
    readonly liveLabel: string
    readonly footnote: string
    readonly emptyLabel: string
    readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
    readonly retry: () => void
}

/** One category chip: the group and how many connectors it holds. */
export interface LibraryCategory {
    readonly id: string
    readonly label: string
    readonly count: number
}

/** The availability chip beside a tile's name: early access or planned. */
export interface LibraryTag {
    readonly tone: "accent" | "neutral"
    readonly label: string
}

/** What the workspace runs of a connector, at the foot of its tile. */
export interface LibraryStatus {
    readonly tone: "success" | "danger" | "warning" | "muted"
    readonly label: string
    readonly isDot: boolean
}

/** One connector tile, with its words resolved. */
export interface LibraryCard {
    readonly id: string
    readonly name: string
    readonly blurb: string
    /** What the connector is for and whom it serves, one line. */
    readonly audienceLine: string
    readonly glyph: ConnectorGlyph
    readonly logo?: string
    /** The provider id the guide tour points at; absent for a planned connector. */
    readonly guide?: string
    readonly tag: LibraryTag | null
    readonly status: LibraryStatus
    /** How many connections of it the workspace runs: with some, the tile offers "Add". */
    readonly connected: number
    /** One of the connectors the workspace can use today. */
    readonly isCurrent: boolean
    /** The library group it heads under: chat, money, google, data, sales, accounting. */
    readonly group: string
    /** What it holds many of ("Many bots"), beside its name; a planned connector says it is planned instead. */
    readonly byline: string
    /** Its "add another" command ("Add bot"), once the workspace has one. */
    readonly addLabel: string
    /** A planned connector: no page, only the "I want it" command. */
    readonly isSoon: boolean
    /** The viewer may start a connection of it; otherwise the tile only opens its detail to read. */
    readonly canConnect: boolean
    /** The address of the only connection a workspace can have of it (Google Drive), once it has one. */
    readonly pageHref?: string
    /** A connection of it needs the owner (fix, continue the setup, reconnect): the tile's one command opens that connection. */
    readonly lifeAction?: { readonly label: string; readonly href: string }
    /** A planned connector: the state of its "I need this" command. */
    readonly want: { readonly isPending: boolean; readonly isDone: boolean; readonly note?: string }
}

/** What a member who may not read a provider page sees in place of it: the trail home and one notice saying who can. */
export interface ConnectionRefusalView {
    readonly title: string
    readonly crumbLabel: string
    readonly homeLabel: string
    readonly homeHref: string
    readonly message: string
    readonly description: string
}

/** The tabs every connection page has. */
export type ConnectionPageTabId = "overview" | "events" | "agents" | "settings"

/** The tabs of a connection page as links of its own address, and the one the address opens. */
export interface ConnectionPageTabsView {
    readonly label: string
    readonly selected: ConnectionPageTabId
    readonly items: ReadonlyArray<{
        readonly id: ConnectionPageTabId
        readonly label: string
        readonly href: string
        readonly count?: number
    }>
    /** The address of one tab. */
    readonly hrefOf: (id: ConnectionPageTabId) => string
}

/** The setup card of a connection page while the connection is unfinished: the four phases and the one being worked on. */
export interface ConnectionSetupView {
    /** "Setup · step 3/4". */
    readonly title: string
    readonly phases: ReadonlyArray<string>
    /** 1-based. */
    readonly current: number
    readonly stateLabels: { readonly complete: string; readonly current: string; readonly upcoming: string }
}
