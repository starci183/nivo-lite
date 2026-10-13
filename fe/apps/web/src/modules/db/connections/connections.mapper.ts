import type { Database } from "../../../../../../../supabase/types/database.types"
import type {
    Access,
    Connection,
    ConnectionGrant,
    ConnectionStatus,
    Environment,
    FirstEvent,
    Provider,
} from "@/modules/types"

/** One connections row from the generated database contract. */
export type ConnectionsRow = Database["public"]["Tables"]["connections"]["Row"]

/** One agent_connections row from the generated database contract. */
export type AgentConnectionsRow = Database["public"]["Tables"]["agent_connections"]["Row"]

/** The connections columns the console reads: facts only, never a secret. */
export const CONNECTION_COLUMNS =
    "id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, last_event_at, first_event"

/** The grant columns the console reads. */
export const GRANT_COLUMNS = "agent_id, connection_id, access"

/** The columns of the connections table the console selects. */
export type ConnectionSelected = Pick<
    ConnectionsRow,
    | "id"
    | "workspace_id"
    | "provider"
    | "name"
    | "public_meta"
    | "status"
    | "last_error"
    | "environment"
    | "is_default"
    | "last_event_at"
    | "first_event"
>

const PROVIDER_IDS: ReadonlySet<string> = new Set([
    "telegram",
    "sepay",
    "zalo_oa",
    "payos",
    "casso",
    "webhook",
    "google",
    "smtp",
    "openapi",
    "database",
    "csv_import",
    "imap",
    "telegram_user",
    "meta",
])

const STATUSES: ReadonlySet<string> = new Set(["pending", "connected", "error", "disconnected"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CONNECTOR_ID = /^[a-z0-9_]{1,60}$/u
const MAX_WISHES = 200
const MAX_RETURN_PATH = 200

const isProviderId = (value: string): value is Provider => PROVIDER_IDS.has(value)
const isStatus = (value: string): value is ConnectionStatus => STATUSES.has(value)
const isLevel = (value: unknown): value is Access => value === "read" || value === "ask" || value === "auto"
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** Whether the text is a workspace id the console can pass on: a UUID. */
export const isWorkspaceId = (value: unknown): value is string => isUuid(value)

const metaOf = (value: ConnectionsRow["public_meta"]): Readonly<Record<string, string>> => {
    if (!isRecord(value)) return {}
    return Object.fromEntries(
        Object.entries(value).flatMap(([key, entry]) => (typeof entry === "string" ? [[key, entry]] : [])),
    )
}

const firstEventOf = (value: ConnectionsRow["first_event"]): FirstEvent | null => {
    if (!isRecord(value)) return null
    const { amount, content, at } = value
    return typeof amount === "number" && typeof content === "string" && typeof at === "string"
        ? { amount, content, at }
        : null
}

/** Maps one connections row and the grants of that connection to the console read model; null when the provider is not one the console offers. */
export const toConnection = (row: ConnectionSelected, grants: ReadonlyArray<ConnectionGrant>): Connection | null => {
    if (!isProviderId(row.provider) || !isStatus(row.status)) return null
    const environment: Environment = row.environment === "test" ? "test" : "live"
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        provider: row.provider,
        name: row.name,
        meta: metaOf(row.public_meta),
        status: row.status,
        lastError: row.last_error,
        environment,
        isDefault: row.is_default,
        lastEventAt: row.last_event_at,
        firstEvent: firstEventOf(row.first_event),
        agentIds: grants.map((grant) => grant.agentId),
        grants,
    }
}

/** Groups the grant rows by connection; a null level on an old row counts as the full level it had before levels existed. */
export const grantsByConnection = (
    rows: ReadonlyArray<Pick<AgentConnectionsRow, "agent_id" | "connection_id" | "access">>,
): Map<string, Array<ConnectionGrant>> => {
    const byConnection = new Map<string, Array<ConnectionGrant>>()
    for (const row of rows) {
        const access: Access = isLevel(row.access) ? row.access : "auto"
        byConnection.set(row.connection_id, [
            ...(byConnection.get(row.connection_id) ?? []),
            { agentId: row.agent_id, access },
        ])
    }
    return byConnection
}

