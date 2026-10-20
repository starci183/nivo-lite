import { HAKUEN_MANIFEST } from "./adapters/hakuen.manifest"
import type {
    ArgConstraint,
    CallLogView,
    CallOutcome,
    ConnectorStatus,
    GatewayConnectorManifest,
    GatewayToolSpec,
    GrantMode,
    GrantView,
    JsonObject,
    ToolGrant,
    ToolScope,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import type { CallLogRow, ConnectorRow, GrantRow, WorkspaceGrantRow } from "./persistence/mcp-gateway.rows"

/** The manifests NIVO knows for remote contracts, by key. */
const KNOWN_REMOTE: ReadonlyMap<string, GatewayConnectorManifest> = new Map([[HAKUEN_MANIFEST.key, HAKUEN_MANIFEST]])
const MODES: ReadonlyArray<GrantMode> = ["auto", "ask", "never"]
const SCOPES: ReadonlyArray<ToolScope> = ["read", "write", "restricted"]
const STATUSES: ReadonlyArray<ConnectorStatus> = ["active", "disabled", "degraded"]
const OUTCOMES: ReadonlyArray<CallOutcome> = ["ok", "error", "refused", "approval", "timeout", "circuit_open"]

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const pick = <T extends string>(allowed: ReadonlyArray<T>, value: unknown, fallback: T): T =>
    allowed.find((entry) => entry === value) ?? fallback

const numberOrNull = (value: string | number | null): number | null => {
    if (value === null) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** The mode a text names, `never` when it names none. */
export const modeOf = (value: unknown): GrantMode => pick(MODES, value, "never")

/**
 * One catalog entry as a spec: the remote server's name, description and schema, with the scope, default mode and masked members of
 * the known manifest. A tool the known manifest does not have is a write that starts at `never`.
 */
const specOfEntry = (entry: unknown, known: GatewayConnectorManifest | undefined): ReadonlyArray<GatewayToolSpec> => {
    if (!isObject(entry) || textOf(entry.name) === "") return []
    const name = textOf(entry.name)
    const base = known?.tools.find((spec) => spec.name === name)
    return [
        {
            name,
            description: textOf(entry.description) || (base?.description ?? ""),
            scope: pick(SCOPES, entry.scope, base?.scope ?? "write"),
            inputSchema: isObject(entry.inputSchema) ? entry.inputSchema : (base?.inputSchema ?? {}),
            defaultMode: base?.defaultMode ?? "never",
            secretFields: base?.secretFields ?? [],
        },
    ]
}

/** A remote connector row as the gateway runs it; an empty catalog falls back to the known manifest of its key. */
export const remoteConnectorOf = (row: ConnectorRow): WorkspaceConnector => {
    const known = KNOWN_REMOTE.get(row.key)
    const entries: ReadonlyArray<unknown> = Array.isArray(row.tool_catalog) ? row.tool_catalog : []
    const tools = entries.flatMap((entry) => specOfEntry(entry, known))
    return {
        manifest: {
            key: row.key,
            name: row.name,
            kind: "remote",
            contractVersion: row.contract_version,
            tools: tools.length > 0 ? tools : (known?.tools ?? []),
        },
        status: pick(STATUSES, row.status, "disabled"),
        url: row.url,
        credentialRef: row.credential_ref,
        timeoutMs: row.timeout_ms,
    }
}

/** The status a native connector has in a workspace: its row's, else active. */
export const nativeStatusOf = (rows: ReadonlyArray<ConnectorRow>, key: string): ConnectorStatus => {
    const row = rows.find((entry) => entry.key === key && entry.kind === "native")
    return row === undefined ? "active" : pick(STATUSES, row.status, "disabled")
}

/** The well-formed argument constraints of a stored list. */
export const constraintsOf = (value: unknown): ReadonlyArray<ArgConstraint> =>
    (Array.isArray(value) ? value : []).flatMap((entry: unknown) =>
        isObject(entry) && typeof entry.arg === "string" && entry.arg !== "" && typeof entry.max === "number"
            ? [{ arg: entry.arg, max: entry.max }]
            : [],
    )

/** The constraints of a JSON text; null when the text is not a JSON array. Absent text means none. */
export const constraintsOfJson = (text: string | null | undefined): ReadonlyArray<ArgConstraint> | null => {
    if (text === null || text === undefined || text.trim() === "") return []
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        return null
    }
    return Array.isArray(parsed) ? constraintsOf(parsed) : null
}

/** A grant row as a grant. */
export const grantOf = (row: GrantRow): ToolGrant => ({
    tool: row.tool,
    mode: modeOf(row.mode),
    limitVnd: numberOrNull(row.limit_vnd),
    constraints: constraintsOf(row.constraints),
})

/** A workspace grant row as the console reads it. */
export const grantViewOf = (row: WorkspaceGrantRow): GrantView => {
    const grant = grantOf(row)
    return {
        ...grant,
        agentId: row.agent_id,
        agentName: row.agent_name,
        constraintsJson: JSON.stringify(grant.constraints),
    }
}

/** An audit row as the console reads it. */
export const callLogViewOf = (row: CallLogRow): CallLogView => ({
    id: row.id,
    tool: row.tool,
    agentName: row.agent_name,
    outcome: pick(OUTCOMES, row.outcome, "error"),
    errorCode: row.error_code,
    argsMasked: row.args_masked,
    resultSummary: row.result_summary,
    durationMs: row.duration_ms,
    approvedBy: row.approved_by,
    at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
})

/** A catalog snapshot entry from a remote tool, kept as plain JSON. */
export const catalogEntryOf = (tool: {
    readonly name: string
    readonly description: string
    readonly inputSchema: JsonObject
}) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
})
