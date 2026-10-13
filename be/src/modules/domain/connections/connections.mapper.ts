import type { ConnectionRecord, ConnectionStatus, Environment, FirstEvent, Provider } from "./connections.contracts"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionSelectRow } from "./persistence/connections.rows"

const PROVIDERS: Readonly<Record<Provider, true>> = {
    telegram: true,
    sepay: true,
    zalo_oa: true,
    payos: true,
    casso: true,
    webhook: true,
    google: true,
    google_drive: true,
    smtp: true,
    openapi: true,
    database: true,
    csv_import: true,
    imap: true,
    telegram_user: true,
    meta: true,
}

const STATUSES: Readonly<Record<ConnectionStatus, true>> = {
    pending: true,
    connected: true,
    error: true,
    disconnected: true,
}

const isProvider = (value: string): value is Provider => Object.hasOwn(PROVIDERS, value)

const isStatus = (value: string): value is ConnectionStatus => Object.hasOwn(STATUSES, value)

const isRecordObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asMeta = (value: unknown): Readonly<Record<string, string>> =>
    isRecordObject(value)
        ? Object.fromEntries(
              Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : {}

const asFirstEvent = (value: unknown): FirstEvent | null => {
    if (!isRecordObject(value)) return null
    const { amount, content, at, text } = value
    if (typeof amount !== "number" || typeof content !== "string" || typeof at !== "string") return null
    return typeof text === "string" ? { amount, content, at, text } : { amount, content, at }
}

const asEnvironment = (value: string | null): Environment => (value === "test" ? "test" : "live")

/** Maps a stored connection row to the record the capability answers; the secret is never part of it. */
export const toConnectionRecord = (row: ConnectionSelectRow): ConnectionRecord => {
    const { provider, status } = row
    if (!isProvider(provider) || !isStatus(status)) {
        throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: row.id } })
    }
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        provider,
        name: row.name,
        meta: asMeta(row.public_meta),
        status,
        lastError: row.last_error,
        environment: asEnvironment(row.environment),
        isDefault: Boolean(row.is_default),
        lastEventAt: row.last_event_at,
        firstEvent: asFirstEvent(row.first_event),
        createdBy: row.created_by,
        createdAt: row.created_at,
    }
}
