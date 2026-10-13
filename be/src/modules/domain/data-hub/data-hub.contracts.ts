import type { ConnectionStatus } from "@modules/domain/connections"

/** The kinds of connection that bring a workspace's own systems into the data hub. */
export type DataProvider = "openapi" | "database" | "csv_import" | "imap" | "telegram_user"

/** The providers, for filters. */
export const DATA_PROVIDERS: ReadonlyArray<DataProvider> = [
    "openapi",
    "database",
    "csv_import",
    "imap",
    "telegram_user",
]

/** True when a connection provider is one of the data providers. */
export const isDataProvider = (provider: string): provider is DataProvider =>
    DATA_PROVIDERS.some((candidate) => candidate === provider)

/** What a hub row is about. */
export type DataEntity = "customer" | "order" | "product" | "transaction" | "message" | "document" | "other"

/** One row for the hub; re-syncing the same external id updates the row. */
export interface DataRecordInput {
    /** The source's own stable id (a row key, an API id, a message id). */
    readonly externalId: string
    /** One human line: a name, an order number, a subject. */
    readonly title?: string
    /** When it happened at the source, when known. */
    readonly occurredAt?: string | Date | null
    /** The mapped fields. */
    readonly data: Readonly<Record<string, unknown>>
}

/** A data connection of a workspace, without any secret. */
export interface DataConnection {
    /** The connection id. */
    readonly id: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** Which kind of system it reads. */
    readonly provider: DataProvider
    /** The name the owner gave it. */
    readonly name: string
    /** The connection status. */
    readonly status: ConnectionStatus
    /** The last failure shown to the owner, if any. */
    readonly lastError: string | null
    /** Non-secret facts: the saved configuration, a summary, cursors. */
    readonly meta: Readonly<Record<string, string>>
    /** Minutes between two scheduled syncs; null is manual only. */
    readonly everyMinutes: number | null
    /** When the last sync finished, ISO 8601; null when none did. */
    readonly lastSyncAt: string | null
}

/** What a sync run is given. */
export interface DataSyncContext {
    /** The connection being synced. */
    readonly connection: DataConnection
    /** The opened credential, as the wizard stored it (a JSON string the provider defines). */
    readonly credential: string
    /** Writes rows of one entity into the hub; answers how many were written. */
    readonly upsert: (entity: DataEntity, rows: ReadonlyArray<DataRecordInput>) => Promise<number>
    /** True once the run's time budget is spent: stop early and answer what was done. */
    readonly isExpired: () => boolean
}

/** What a sync run answers. */
export interface DataSyncResult {
    /** How many rows were written. */
    readonly rows: number
    /** A sentence for the owner (what was done, what is left). */
    readonly note?: string
    /** Public facts to merge into the connection (cursors, a summary). */
    readonly meta?: Readonly<Record<string, string>>
}

/** The reader of one provider: pulls from the owner's system into the hub. A failure is thrown with a plain-language message. */
export interface DataConnector {
    /** The provider this connector serves. */
    readonly provider: DataProvider
    /** Pulls from the source into the hub. */
    sync(context: DataSyncContext): Promise<DataSyncResult>
}

/** How a sync run was started. */
export type DataSyncTrigger = "schedule" | "manual" | "upload" | "push"

/** The state of one sync run. */
export type DataSyncRunState = "running" | "ok" | "failed"

/** One recorded sync run. */
export interface DataSyncRun {
    /** The run id. */
    readonly id: string
    /** The connection it synced. */
    readonly connectionId: string
    /** How it started. */
    readonly trigger: DataSyncTrigger
    /** Where it is. */
    readonly state: DataSyncRunState
    /** How many rows it wrote. */
    readonly rows: number
    /** The failure, when it failed. */
    readonly error: string | null
    /** When it started, ISO 8601. */
    readonly startedAt: string
    /** When it ended, ISO 8601; null while it runs. */
    readonly finishedAt: string | null
}

/** What changing a data connection takes. */
export interface DataConnectionChange {
    /** The new name. */
    readonly name: string
    /** The new public facts (replace the old). */
    readonly meta: Readonly<Record<string, string>>
    /** The new schedule in minutes; null is manual only. */
    readonly everyMinutes: number | null
}

/** What creating a data connection takes. */
export interface DataConnectionDraft extends DataConnectionChange {
    /** Which kind of system it reads. */
    readonly provider: DataProvider
    /** The credential in plain text; it is sealed before it is stored. */
    readonly credential: string
    /** `pending` for a wizard that is not finished, `connected` otherwise. */
    readonly status?: "pending" | "connected"
}
