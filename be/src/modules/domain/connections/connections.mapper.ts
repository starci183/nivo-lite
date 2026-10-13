import type { ConnectionRecord, Environment, FirstEvent, Provider, ConnectionStatus } from "./connections.contracts"
import type { ConnectionSelectRow } from "./persistence/connections.rows"

const asMeta = (value: unknown): Readonly<Record<string, string>> =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, string>) : {}

/** Maps a stored connection row to the record the capability answers; the secret is never part of it. */
export const toConnectionRecord = (row: ConnectionSelectRow): ConnectionRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider as Provider,
    name: row.name,
    meta: asMeta(row.public_meta),
    status: row.status as ConnectionStatus,
    lastError: row.last_error,
    environment: (row.environment ?? "live") as Environment,
    isDefault: Boolean(row.is_default),
    lastEventAt: row.last_event_at,
    firstEvent: row.first_event as FirstEvent | null,
    createdBy: row.created_by,
    createdAt: row.created_at,
})
