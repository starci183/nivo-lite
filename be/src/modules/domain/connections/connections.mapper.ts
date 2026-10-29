import type { ConnectionRecord, ConnectionStatus, Environment, FirstEvent, Provider } from "./connections.contracts"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionProjection } from "./persistence/connection-projection"

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

/** Meta keys a person may have stored as a number (a Telegram chat id is one): they are read as text. */
const NUMERIC_TEXT_KEYS: ReadonlySet<string> = new Set(["owner_chat_id"])

const metaText = (key: string, value: unknown): string | null => {
    if (typeof value === "string") return value
    return typeof value === "number" && Number.isFinite(value) && NUMERIC_TEXT_KEYS.has(key) ? String(value) : null
}

const asMeta = (value: unknown): Readonly<Record<string, string>> =>
    isRecordObject(value)
        ? Object.fromEntries(
              Object.entries(value)
                  .map(([key, entry]) => [key, metaText(key, entry)] as const)
                  .filter((entry): entry is readonly [string, string] => entry[1] !== null),
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
export const toConnectionRecord = (row: ConnectionProjection): ConnectionRecord => {
    const { provider, status } = row
    if (!isProvider(provider) || !isStatus(status)) {
        throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: row.id } })
    }
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        provider,
        name: row.name,
        meta: asMeta(row.publicMeta),
        status,
        lastError: row.lastError,
        environment: asEnvironment(row.environment),
        isDefault: Boolean(row.isDefault),
        lastEventAt: row.lastEventAt,
        firstEvent: asFirstEvent(row.firstEvent),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
    }
}
