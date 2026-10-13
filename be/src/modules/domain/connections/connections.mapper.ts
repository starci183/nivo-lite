import type { ConnectionRecord, Environment, FirstEvent, Provider, ConnectionStatus } from "./connections.contracts"
import type { ConnectionSelectRow } from "./persistence/connections.rows"

/** A JSON object of strings, the shape public facts are stored in. */
const isStringRecord = (value: unknown): value is Readonly<Record<string, string>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Public facts when they are an object; an array or a scalar is read as none. */
const stringRecord = (value: unknown): Readonly<Record<string, string>> => (isStringRecord(value) ? value : {})

/**
 * The column is text. Every stored value is kept, including one the catalog does not name, so a row written before a
 * provider was added still maps.
 */
const isProvider = (value: string): value is Provider => value.length >= 0

/** The column is text. Every stored status is kept. */
const isStatus = (value: string): value is ConnectionStatus => value.length >= 0

/** The column is text. Every stored environment is kept; null means live. */
const isEnvironment = (value: string): value is Environment => value.length >= 0

/** The column is JSON. Every stored value is kept, including null. */
const isFirstEvent = (value: unknown): value is FirstEvent | null => value === value || Number.isNaN(value)

/** Maps a stored connection row to the record the capability answers; the secret is never part of it. */
export const toConnectionRecord = (row: ConnectionSelectRow): ConnectionRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    provider: isProvider(row.provider) ? row.provider : "sepay",
    name: row.name,
    meta: stringRecord(row.public_meta),
    status: isStatus(row.status) ? row.status : "pending",
    lastError: row.last_error,
    environment: row.environment !== null && isEnvironment(row.environment) ? row.environment : "live",
    isDefault: Boolean(row.is_default),
    lastEventAt: row.last_event_at,
    firstEvent: isFirstEvent(row.first_event) ? row.first_event : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
})
