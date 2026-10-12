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
