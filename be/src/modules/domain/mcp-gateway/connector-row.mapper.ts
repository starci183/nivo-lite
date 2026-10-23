import type { McpCallLogRow } from "@modules/domain/mcp-call-log"
import { credentialStateOf } from "@modules/domain/mcp-connectors"
import type { McpConnectorRow } from "@modules/domain/mcp-connectors"
import type { ArgConstraint, GrantMode, McpToolGrantRow, McpWorkspaceGrantRow } from "@modules/domain/mcp-tool-grants"
import type { McpRemoteTool } from "@modules/integrations/mcp"
import { parseJsonText } from "@modules/platform/primitives"
import { argsHashOf } from "./audit-mask.policy"
import type {
    CapabilityRole,
    CallLogView,
    CallOutcome,
    ConnectorStatus,
    GatewayJson,
    GatewayToolSpec,
    GrantView,
    NativeAdapter,
    ToolGrant,
    ToolScope,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"

/** The shortest per-call limit a connector may have, milliseconds (the mcp_connectors timeout check). */
const TIMEOUT_MIN_MS = 500
/** The longest per-call limit a connector may have, milliseconds (the mcp_connectors timeout check). */
const TIMEOUT_MAX_MS = 15_000
/** The argument a remote write tool takes its replay key in, when its schema declares it. */
const REPLAY_ARG = "idempotencyKey"
/** The `_meta` member a remote tool declares its NIVO capability role in. */
const ROLE_META = "nivo/role"
/** The `_meta` member a remote tool lists the result and argument members the audit must mask in. */
const MASKED_MEMBERS_META = "nivo/secretFields"
const ROLES: ReadonlyArray<CapabilityRole> = [
    "identity.find",
    "identity.upsert",
    "receivable.find",
    "receivable.recordPayment",
    "payment.credits.list",
    "payment.debits.list",
    "invoice.list",
]
const MODES: ReadonlyArray<GrantMode> = ["auto", "ask", "never"]
const STATUSES: ReadonlyArray<ConnectorStatus> = ["active", "disabled", "degraded"]
const OUTCOMES: ReadonlyArray<CallOutcome> = ["ok", "error", "refused", "approval", "timeout", "circuit_open"]

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const pick = <T extends string>(allowed: ReadonlyArray<T>, value: unknown, fallback: T): T =>
    allowed.find((entry) => entry === value) ?? fallback

const numberOrNull = (value: string | number | null): number | null => {
    if (value === null) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** A per-call limit within the gateway's bounds. */
const boundedTimeoutOf = (value: number): number => Math.min(TIMEOUT_MAX_MS, Math.max(TIMEOUT_MIN_MS, value))

/** The name to schema-hash pairs of a stored catalog (live or approved); entries without both are left out. */
const hashesOf = (catalog: unknown): ReadonlyMap<string, string> =>
    new Map(
        (Array.isArray(catalog) ? catalog : []).flatMap((entry: unknown) =>
            isObject(entry) && textOf(entry.name) !== "" && textOf(entry.hash) !== ""
                ? [[textOf(entry.name), textOf(entry.hash)] as const]
                : [],
        ),
    )

/** The remote tools that may run: those whose live schema hash is the approved one. */
const approvedToolsOf = (row: McpConnectorRow): ReadonlySet<string> => {
    const approved = hashesOf(row.approved_catalog)
    return new Set(
        [...hashesOf(row.tool_catalog)].flatMap(([name, hash]) => (approved.get(name) === hash ? [name] : [])),
    )
}

/** The mode a text names, `never` when it names none. */
export const modeOf = (value: unknown): GrantMode => pick(MODES, value, "never")

/** What a remote tool declares about itself in its `annotations` and `_meta`: its scope, role and masked members. */
interface Declared {
    /** Read when the server hints it is read-only, else write. */
    readonly scope: ToolScope
    /** The members the audit masks. */
    readonly secretFields: ReadonlyArray<string>
    /** The replay-key argument and the role, when declared. */
    readonly extra: Pick<GatewayToolSpec, "idempotencyArg" | "role">
}

/** The declarations of one catalog entry; hints are data the owner approved with the schema, never code of a connector. */
const declaredOf = (entry: GatewayJson): Declared => {
    const annotations = isObject(entry.annotations) ? entry.annotations : {}
    const meta = isObject(entry.meta) ? entry.meta : {}
    const schema = isObject(entry.inputSchema) ? entry.inputSchema : {}
    const properties = isObject(schema.properties) ? schema.properties : {}
    const secrets: ReadonlyArray<unknown> = Array.isArray(meta[MASKED_MEMBERS_META]) ? meta[MASKED_MEMBERS_META] : []
    const role = ROLES.find((known) => known === meta[ROLE_META])
    return {
        scope: annotations.readOnlyHint === true ? "read" : "write",
        secretFields: secrets.filter((field): field is string => typeof field === "string"),
        extra: {
            ...(REPLAY_ARG in properties ? { idempotencyArg: REPLAY_ARG } : {}),
            ...(role === undefined ? {} : { role }),
        },
    }
}

/**
 * One catalog entry as a spec: the remote server's name, description and schema with what it declares (scope from the read-only
 * hint, role and masked members from `_meta`). A new grant of it starts at `never`; nothing about a connector lives in code.
 */
const specOfEntry = (entry: unknown): ReadonlyArray<GatewayToolSpec> => {
    if (!isObject(entry) || textOf(entry.name) === "") return []
    const declared = declaredOf(entry)
    return [
        {
            name: textOf(entry.name),
            description: textOf(entry.description),
            scope: declared.scope,
            inputSchema: isObject(entry.inputSchema) ? entry.inputSchema : {},
            defaultMode: "never",
            secretFields: declared.secretFields,
            ...declared.extra,
        },
    ]
}

/** A remote connector row as the gateway runs it: its tools are the pinned live catalog, nothing else. */
export const remoteConnectorOf = (row: McpConnectorRow): WorkspaceConnector => {
    const entries: ReadonlyArray<unknown> = Array.isArray(row.tool_catalog) ? row.tool_catalog : []
    const tools = entries.flatMap(specOfEntry)
    return {
        manifest: {
            key: row.key,
            name: row.name,
            kind: "remote",
            contractVersion: row.contract_version,
            tools,
        },
        status: pick(STATUSES, row.status, "disabled"),
        url: row.url,
        credentialState: credentialStateOf(row.credential_state),
        credentialSetAt: row.credential_set_at,
        timeoutMs: boundedTimeoutOf(row.timeout_ms),
        approvedTools: approvedToolsOf(row),
        approvedAt: row.approved_at,
        checkedAt: row.checked_at,
    }
}

/**
 * A native connector as a workspace runs it: its manifest from code, the status and the per-call limit of its row when the
 * workspace has one, else active with the gateway's default limit. Every native tool may run (its tools are code).
 */
export const nativeConnectorOf = (
    rows: ReadonlyArray<McpConnectorRow>,
    adapter: NativeAdapter,
    defaultTimeoutMs: number,
): WorkspaceConnector => {
    const row = rows.find((entry) => entry.key === adapter.manifest.key && entry.kind === "native")
    return {
        manifest: adapter.manifest,
        status: row === undefined ? "active" : pick(STATUSES, row.status, "disabled"),
        url: null,
        credentialState: "none",
        credentialSetAt: null,
        timeoutMs: boundedTimeoutOf(row?.timeout_ms ?? defaultTimeoutMs),
        approvedTools: null,
        approvedAt: null,
        checkedAt: row?.checked_at ?? null,
    }
}

/** The { name, hash } pairs of the live catalog of a row, the approval of exactly that snapshot. */
export const approvalOf = (row: McpConnectorRow): ReadonlyArray<GatewayJson> =>
    [...hashesOf(row.tool_catalog)].map(([name, hash]) => ({ name, hash }))

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
    const parsed = parseJsonText(text)
    return parsed.ok && Array.isArray(parsed.value) ? constraintsOf(parsed.value) : null
}

/** A grant row as a grant. */
export const grantOf = (row: McpToolGrantRow): ToolGrant => ({
    tool: row.tool,
    mode: modeOf(row.mode),
    limitVnd: numberOrNull(row.limit_vnd),
    constraints: constraintsOf(row.constraints),
})

/** A workspace grant row as the console reads it. */
export const grantViewOf = (row: McpWorkspaceGrantRow): GrantView => {
    const grant = grantOf(row)
    return {
        ...grant,
        agentId: row.agent_id,
        agentName: row.agent_name,
        constraintsJson: JSON.stringify(grant.constraints),
    }
}

/** An audit row as the console reads it. */
export const callLogViewOf = (row: McpCallLogRow): CallLogView => ({
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

/**
 * A catalog snapshot entry from a remote tool, kept as plain JSON with the sha256 of everything the gateway reads from it (name,
 * description, schema, annotations and `_meta`, so a changed role or hint needs a new approval like a changed schema).
 */
export const catalogEntryOf = (tool: McpRemoteTool): GatewayJson => {
    const pinned = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        meta: tool.meta,
    }
    return { ...pinned, hash: argsHashOf(pinned) }
}
