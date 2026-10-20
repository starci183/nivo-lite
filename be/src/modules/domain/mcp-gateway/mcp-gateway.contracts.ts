/** How far an agent may use a tool: alone, after a person approves, or not at all (the default). */
export type GrantMode = "auto" | "ask" | "never"

/** What a tool does to the connected system. */
export type ToolScope = "read" | "write" | "restricted"

/** A JSON object argument or result. */
export type JsonObject = Readonly<Record<string, unknown>>

/** One tool of a connector, without the namespace. */
export interface GatewayToolSpec {
    /** The connector's own name, for example "booking.hold". */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Read, write or restricted. */
    readonly scope: ToolScope
    /** Its JSON schema. */
    readonly inputSchema: JsonObject
    /** The mode a new grant starts at. */
    readonly defaultMode: GrantMode
    /** Members masked in the audit besides the standard secret names. */
    readonly secretFields?: ReadonlyArray<string>
}

/** The manifest of a connector: its namespace, contract and tools. */
export interface GatewayConnectorManifest {
    /** The namespace, for example "hakuen". */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** Native (code) or remote (MCP server). */
    readonly kind: "native" | "remote"
    /** The contract version, for example "hakuen-mcp@1". */
    readonly contractVersion: string
    /** The tools. */
    readonly tools: ReadonlyArray<GatewayToolSpec>
}

/** Whether a connector runs for a workspace. */
export type ConnectorStatus = "active" | "disabled" | "degraded"

/** A connector of one workspace as the gateway runs it. */
export interface WorkspaceConnector {
    /** The manifest. */
    readonly manifest: GatewayConnectorManifest
    /** Active, disabled or degraded. */
    readonly status: ConnectorStatus
    /** The remote endpoint, or null for a native connector. */
    readonly url: string | null
    /** The NAME of the credential secret, never its value. */
    readonly credentialRef: string | null
    /** The per-call limit in milliseconds. */
    readonly timeoutMs: number
}

/** A generic argument constraint of a grant: the numeric argument `arg` runs alone up to `max` (configured per workspace). */
export interface ArgConstraint {
    /** The tool argument, for example "discountPct" of hakuen.booking.confirm. */
    readonly arg: string
    /** The largest value allowed without a person. */
    readonly max: number
}

/** One grant of a tool (or `connector.*`) to an agent. */
export interface ToolGrant {
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** The mode. */
    readonly mode: GrantMode
    /** The largest amount allowed alone, or null. */
    readonly limitVnd: number | null
    /** The argument constraints the call must keep to run alone. */
    readonly constraints: ReadonlyArray<ArgConstraint>
}

/** Who calls the gateway. */
export interface GatewayCaller {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The customer conversation the call serves, or null. */
    readonly conversationId: string | null
    /** The work item the call serves, or null. */
    readonly workItemId: string | null
    /** The person who approved this exact call, when it replays an approval. */
    readonly approvedBy?: string
}

/** Why a call needs a person. */
export type ApprovalReason = "ask_mode" | "price_exception" | "over_limit_vnd" | "no_rule"

/** What the grant check decided for one call. */
export type GrantVerdict =
    | { readonly kind: "allow" }
    | { readonly kind: "refuse" }
    | { readonly kind: "approval"; readonly reason: ApprovalReason }

/** Why a call did not produce a result. */
export type GatewayFailure =
    "invalid_name" | "unknown_tool" | "connector_disabled" | "not_granted" | "unavailable" | "tool_error"

/** The answer of one gateway call. */
export type GatewayCallResult =
    | { readonly ok: true; readonly value: JsonObject }
    | { readonly ok: false; readonly code: "approval_required"; readonly reason: ApprovalReason }
    | { readonly ok: false; readonly code: GatewayFailure; readonly detail: string }

/** One tool the discovery answers. */
export interface DiscoveredTool {
    /** The full name. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Its scope. */
    readonly scope: ToolScope
    /** The caller's mode. */
    readonly mode: GrantMode
}

/** One tool described in full for a caller. */
export interface DescribedTool extends DiscoveredTool {
    /** Its schema. */
    readonly inputSchema: JsonObject
    /** The caller's argument constraints. */
    readonly constraints: ReadonlyArray<ArgConstraint>
    /** The caller's amount limit, or null. */
    readonly limitVnd: number | null
}

/** Outcome of an audited call. */
export type CallOutcome = "ok" | "error" | "refused" | "approval" | "timeout" | "circuit_open"

/** One line of the audit log. */
export interface CallLogEntry {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly connector: string
    /** The full tool name. */
    readonly tool: string
    /** The agent. */
    readonly agentId: string | null
    /** The conversation. */
    readonly conversationId: string | null
    /** The work item. */
    readonly workItemId: string | null
    /** The masked arguments. */
    readonly argsMasked: JsonObject
    /** The sha256 of the real arguments. */
    readonly argsHash: string
    /** The outcome. */
    readonly outcome: CallOutcome
    /** The failure code, or null. */
    readonly errorCode: string | null
    /** The masked summary of the result. */
    readonly resultSummary: string
    /** How long it took. */
    readonly durationMs: number
    /** Who approved it, or null. */
    readonly approvedBy: string | null
}

/** One audit line as the console reads it. */
export interface CallLogView {
    /** The id. */
    readonly id: string
    /** The full tool name. */
    readonly tool: string
    /** The agent's name, or empty. */
    readonly agentName: string
    /** The outcome. */
    readonly outcome: CallOutcome
    /** The failure code, or null. */
    readonly errorCode: string | null
    /** The masked arguments as JSON text. */
    readonly argsMasked: string
    /** The masked result summary. */
    readonly resultSummary: string
    /** The duration. */
    readonly durationMs: number
    /** Who approved, or null. */
    readonly approvedBy: string | null
    /** When, ISO. */
    readonly at: string
}

/** One grant row as the console reads it. */
export interface GrantView extends ToolGrant {
    /** The agent. */
    readonly agentId: string
    /** The agent's name. */
    readonly agentName: string
    /** The constraints as JSON text, for the console. */
    readonly constraintsJson: string
}

/** A connector as the console reads it. */
export interface ConnectorView {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** Native or remote. */
    readonly kind: "native" | "remote"
    /** The status. */
    readonly status: ConnectorStatus
    /** The remote URL, or null. */
    readonly url: string | null
    /** The credential NAME, or null. */
    readonly credentialRef: string | null
    /** The contract version. */
    readonly contractVersion: string
    /** The per-call limit. */
    readonly timeoutMs: number
    /** The full names of its tools with their scope and default mode. */
    readonly tools: ReadonlyArray<{ readonly name: string; readonly scope: ToolScope; readonly description: string }>
}

/** The state of a connector's breaker. */
export interface BreakerState {
    /** When the recent failures happened, epoch ms. */
    readonly failures: ReadonlyArray<number>
    /** Until when it stays open, epoch ms, or null when closed. */
    readonly openUntil: number | null
}

/** A native connector: its manifest and how it runs a tool. */
export interface NativeAdapter {
    /** The manifest. */
    readonly manifest: GatewayConnectorManifest
    /** Runs one tool for a workspace. */
    invoke(workspaceId: string, tool: string, args: JsonObject): Promise<JsonObject>
}
