import type { SelectQueryBuilder, UpdateQueryBuilder } from "typeorm"
import { returnedRows, rowShape } from "@modules/platform/database"
import type { ConnectionEntity } from "./entities"

/** A timestamp column as the ISO text the contracts carry (UTC, millisecond precision). */
export const isoText = (column: string): string =>
    `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

/** The columns the service reads of a connection, with the timestamps already worded as ISO text. */
export interface ConnectionProjection {
    /** The connection row id every command and grant refers to. */
    readonly id: string
    /** The workspace that owns the connection; reads never cross it. */
    readonly workspaceId: string
    /** The provider key that selects the connector behaviour. */
    readonly provider: string
    /** The label the workspace gave the connection. */
    readonly name: string
    /** Provider details safe to show the browser; untrusted until parsed. */
    readonly publicMeta: unknown
    /** The stored lifecycle status, parsed into a connection status before use. */
    readonly status: string
    /** The last failure message shown to the user; null when the connection is healthy. */
    readonly lastError: string | null
    /** `test` or `live`; null reads as live. */
    readonly environment: string | null
    /** Whether this is the workspace default of its provider. */
    readonly isDefault: boolean | null
    /** When the provider last delivered an event, ISO text; null when it never has. */
    readonly lastEventAt: string | null
    /** The first delivered event kept as proof the webhook works; untrusted until parsed. */
    readonly firstEvent: unknown
    /** The member who created the connection; null for system-created ones. */
    readonly createdBy: string | null
    /** When the connection was created, ISO text. */
    readonly createdAt: string
}

/** Selects the `ConnectionProjection` columns of a connections query (alias `c`), to answer through `getRawMany` / `getRawOne`. */
export const projectConnections = (query: SelectQueryBuilder<ConnectionEntity>): SelectQueryBuilder<ConnectionEntity> =>
    query
        .select("c.id", "id")
        .addSelect("c.workspace_id", "workspaceId")
        .addSelect("c.provider", "provider")
        .addSelect("c.name", "name")
        .addSelect("c.public_meta", "publicMeta")
        .addSelect("c.status", "status")
        .addSelect("c.last_error", "lastError")
        .addSelect("c.environment", "environment")
        .addSelect("c.is_default", "isDefault")
        .addSelect(isoText("c.last_event_at"), "lastEventAt")
        .addSelect("c.first_event", "firstEvent")
        .addSelect("c.created_by", "createdBy")
        .addSelect(isoText("c.created_at"), "createdAt")

/** The changes one connection update carries. */
export type ConnectionChanges = Parameters<UpdateQueryBuilder<ConnectionEntity>["set"]>[0]

/** The ids a write returned. */
export const returnedIds = (raw: unknown): ReadonlyArray<string> =>
    returnedRows(raw, rowShape({ id: "string" })).map((row) => row.id)

/** The id and workspace of each connection a write returned (`RETURNING id, workspace_id`). */
export const returnedOwners = (raw: unknown): ReadonlyArray<{ id: string; workspaceId: string }> =>
    returnedRows(raw, rowShape({ id: "string", workspace_id: "string" })).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
    }))
