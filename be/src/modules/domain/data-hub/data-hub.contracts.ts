import type { ConnectionStatus } from "@modules/domain/connections"
import type { DataEntity, DataRecordInput } from "@modules/domain/data-records"

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

/** The provider a lookup is narrowed to; absent means any data provider. */
export type ProviderFilter = DataProvider | undefined

/** The sealed credential of a connection once opened; null when none is stored or it cannot be opened. */
export type StoredCredential = string | null

/** A schedule in minutes between two syncs; null or absent is manual only. */
export type SyncMinutes = number | null | undefined

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

export type { DataEntity, DataRecordInput } from "@modules/domain/data-records"
