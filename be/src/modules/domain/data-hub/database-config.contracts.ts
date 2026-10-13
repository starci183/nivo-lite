import type { DatabaseSelection, DatabaseTarget } from "@modules/integrations/data-sources"
import type { DataEntity } from "./data-hub.contracts"

/** What a mapped database table becomes in the hub. */
export type DatabaseEntity = Extract<DataEntity, "customer" | "order" | "product" | "transaction" | "other">

/** The entities, for validation. */
export const DATABASE_ENTITIES: ReadonlyArray<DatabaseEntity> = ["customer", "order", "product", "transaction", "other"]

/** The most tables one connection maps. */
export const DATABASE_MAX_TABLES = 100

/** The sync periods the wizard offers (minutes); null is manual only. */
export const DATABASE_SCHEDULES: ReadonlyArray<number | null> = [null, 15, 60, 360, 1440]

/** One mapped table: where it is, what it becomes and which columns come. Stored (not secret) in the connection's public meta under `config`. */
export interface TableMapping extends DatabaseSelection {
    /** What its rows become in the hub. */
    readonly entity: DatabaseEntity
}

/** The saved mapping of a database connection. */
export interface DatabaseConfig {
    /** The mapped tables. */
    readonly tables: ReadonlyArray<TableMapping>
}

/** A target without its password. */
export type DatabaseTargetView = Omit<DatabaseTarget, "password">

/** What the wizard gets back when it reopens a saved connection (never the password). */
export interface SavedDatabase {
    /** The connection's name. */
    readonly name: string
    /** The saved target without the password. */
    readonly target: DatabaseTargetView
    /** True when a password is stored. */
    readonly hasPassword: boolean
    /** The mapped tables. */
    readonly tables: ReadonlyArray<TableMapping>
    /** Minutes between scheduled syncs; null is manual only. */
    readonly everyMinutes: number | null
    /** The agents that hold a grant on the connection. */
    readonly agentIds: ReadonlyArray<string>
}

/** What testing a database connection takes. */
export interface DatabaseTestDraft {
    /** The saved connection whose stored password may be reused. */
    readonly connectionId?: string | null
    /** How to reach the database; the password is empty to keep the stored one. */
    readonly target: DatabaseTarget
}

/** What previewing one mapped table takes. */
export interface DatabasePreviewDraft extends DatabaseTestDraft {
    /** The table mapping, as typed (cleaned by the capability). */
    readonly mapping: unknown
}

/** What saving a database connection takes. */
export interface DatabaseSaveDraft extends DatabaseTestDraft {
    /** The name the owner gave it. */
    readonly name: string
    /** The mapped tables, as typed (cleaned by the capability). */
    readonly tables: unknown
    /** Minutes between scheduled syncs; null or absent is manual only. */
    readonly everyMinutes?: number | null
}

/** The outcome of reading JSON text: the value, or the failure that stopped it. */
export type JsonOutcome =
    { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly cause: unknown }
