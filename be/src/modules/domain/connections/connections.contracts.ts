/** The kinds of connection a workspace can hold. */
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

/** `test` is the provider test mode: its credits are stored as simulated, never real money. */
export type Environment = "test" | "live"

/** `pending`: created by a wizard but no first event seen yet (or the wizard was abandoned). */
export type ConnectionStatus = "pending" | "connected" | "error" | "disconnected"

/** The roles a workspace member can be asked to hold. */
export type ConnectionRole = "owner" | "manager"

/** The first event a connection accepted (what the wizard shows as received). */
export interface FirstEvent {
    /** The amount of the event. */
    readonly amount: number
    /** The content of the event. */
    readonly content: string
    /** When it arrived, ISO 8601. */
    readonly at: string
    /** An optional readable line of the event. */
    readonly text?: string
}

/** The caller of a console operation: who, in which workspace. */
export interface ConnectionActor {
    /** The verified user id. */
    readonly principalId: string
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** An authorised member: the role they hold and the name shown in audit trails. */
export interface ConnectionMember {
    /** The role of the member in the workspace. */
    readonly role: string
    /** The member display name. */
    readonly displayName: string
}

/** One connection of a workspace, without any secret. */
export interface ConnectionRecord {
    /** The id of the connection. */
    readonly id: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** The provider it connects to. */
    readonly provider: Provider
    /** The name the owner gave it. */
    readonly name: string
    /** Non-secret facts: bot_username, account_masked, bank_code ... */
    readonly meta: Readonly<Record<string, string>>
    /** Where the connection is in its life. */
    readonly status: ConnectionStatus
    /** The last failure shown to the owner, if any. */
    readonly lastError: string | null
    /** Test or live. */
    readonly environment: Environment
    /** SMTP only: the workspace default sender. */
    readonly isDefault: boolean
    /** When the last event arrived, ISO 8601. */
    readonly lastEventAt: string | null
    /** The first event the connection accepted. */
    readonly firstEvent: FirstEvent | null
    /** Who created it. */
    readonly createdBy: string | null
    /** When it was created, ISO 8601. */
    readonly createdAt: string
}

/** The secret to store with a new connection. */
export interface ConnectionSecretInput {
    /** The credential in plain text; it is sealed before it is stored. */
    readonly plain: string
    /** The secret the provider signs its webhooks with. */
    readonly webhookSecret: string
}

/** What creating a connection takes. */
export interface CreateConnectionInput {
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** The user creating it. */
    readonly createdBy: string
    /** The provider it connects to. */
    readonly provider: Provider
    /** The name; trimmed and bounded, at least two characters. */
    readonly name: string
    /** The first status (a wizard starts `pending`). */
    readonly status: "pending" | "connected"
    /** Test or live. */
    readonly environment: Environment
    /** Non-secret facts. */
    readonly meta: Readonly<Record<string, string>>
    /** The credential and webhook secret. */
    readonly secret: ConnectionSecretInput
}

/** The fields of a connection that can change; an absent field stays. */
export interface ConnectionPatch {
    /** A new name. */
    readonly name?: string
    /** A new status. */
    readonly status?: ConnectionStatus
    /** A new environment. */
    readonly environment?: Environment
    /** Replaces the non-secret facts. */
    readonly meta?: Readonly<Record<string, string>>
    /** Sets (or with null clears) the last error. */
    readonly lastError?: string | null
}

/** A stored secret opened for use. */
export interface ConnectionSecret {
    /** The decrypted credential. */
    readonly plain: string
    /** The webhook secret. */
    readonly webhookSecret: string
}

/** What a webhook that authenticated an event reports for its connection. */
export interface ConnectionEvent {
    /** The amount of the event. */
    readonly amount: number
    /** The content of the event. */
    readonly content: string
    /** When it arrived, ISO 8601. */
    readonly at: string
    /** An optional readable line. */
    readonly text?: string
}

/** The facts a webhook needs back after recording an event. */
export interface RecordedEvent {
    /** The connection name. */
    readonly name: string
    /** Test or live. */
    readonly environment: Environment
}

/** What the wizard polls for: has the first event arrived. */
export interface FirstEventState {
    /** The connection status. */
    readonly status: ConnectionStatus
    /** The first event, once there is one. */
    readonly firstEvent: FirstEvent | null
}

/** Options of listing by provider. */
export interface ListByProviderOptions {
    /** Include disconnected connections. */
    readonly includeDisconnected: boolean
}

/** The identity of a connection found by one of its public facts. */
export interface ConnectionOwner {
    /** The id of the connection. */
    readonly id: string
    /** The workspace that owns it. */
    readonly workspaceId: string
}

/** A connection a delivery arrived on, when it is of the provider and not disconnected. */
export interface IntakeConnection {
    /** The connection id. */
    readonly id: string
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection status: pending, connected or error. */
    readonly status: string
}

/** One connection as the health check reads it. */
export interface HealthCandidate {
    /** The connection id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The provider key. */
    readonly provider: string
    /** The connection name. */
    readonly name: string
    /** The connection status. */
    readonly status: string
    /** The last error the connection reported; empty when none. */
    readonly lastError: string
    /** When the connection last received an event, as text; empty when never. */
    readonly lastEventAt: string
    /** When the connection was created, as text. */
    readonly createdAt: string
    /** The health state already recorded: ok, silent, failing, or empty when none. */
    readonly health: string
}

/** The health verdict recorded on a connection. */
export interface HealthMark {
    /** ok, silent or failing. */
    readonly state: string
    /** Why, in a short sentence; empty for ok. */
    readonly reason: string
    /** When it was judged, ISO 8601. */
    readonly checkedAt: string
}

/** The result of a wizard job, written next to its ticket on the connection row. */
export interface WizardSettlement {
    /** What the job was asked to do. */
    readonly command: string
    /** done or failed. */
    readonly state: "done" | "failed"
    /** The page the owner opens next, when the command produced one; empty otherwise. */
    readonly url: string
    /** The code of the refusal, when it failed; empty otherwise. */
    readonly code: string
    /** True when the job sealed the OA Secret Key, which the wizard then shows as saved. */
    readonly oaSecretSaved: boolean
}

/** How often a data connection syncs by itself and when it last did. */
export interface SyncSchedule {
    /** Minutes between two scheduled syncs; null is manual only. */
    readonly everyMinutes: number | null
    /** When the last sync finished, ISO 8601; null when none did. */
    readonly lastSyncAt: string | null
}

/** A configured site or API url as the deployment gave it; undefined when it sets none. */
export type ConfiguredUrl = string | undefined

/** A public https origin providers can reach; null when the site is local, plain http or unset. */
export type OptionalPublicOrigin = string | null

/** The AES key that seals connection secrets; null when the configured value is not exactly 32 bytes. */
export type OptionalChannelKey = Buffer | null

/** A connection name fit to store; null when too little of it remains after trimming. */
export type OptionalConnectionName = string | null

/** A connection of the workspace; null when it does not exist there. */
export type OptionalConnectionRecord = ConnectionRecord | null

/** The connection that owns a public fact; null when no live connection claims it. */
export type OptionalConnectionOwner = ConnectionOwner | null

/** An opened connection secret; null when none is stored or it cannot be opened with the current key. */
export type OptionalConnectionSecret = ConnectionSecret | null

/** What recording an event answers; null when the connection does not exist. */
export type OptionalRecordedEvent = RecordedEvent | null

/** Minutes between two scheduled syncs; null switches the connection to manual syncs only. */
export type SyncInterval = number | null

/** Public facts a finished sync adds to a connection (row counts, sheet names), merged over the old ones. */
export interface SyncFacts {
    readonly [fact: string]: string
}

/** The id of a workspace's default SMTP connection; null when it has none. */
export type OptionalConnectionId = string | null
