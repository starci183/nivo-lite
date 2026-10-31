import type { ConnectionActor } from "@modules/domain/connections"
import type { CredentialState } from "@modules/domain/mcp-connectors"
import type { GatewayApprovalReason, GatewayJson } from "@modules/domain/mcp-gateway-receipts"
import type { ArgConstraint, GrantMode } from "@modules/domain/mcp-tool-grants"
import type { Secret } from "@modules/platform/config"
import type { McpRpcResponse } from "@modules/integrations/mcp"
import type { GatewayArgumentSchema } from "./gateway-tools.schema"

export type { GatewayCallResult, GatewayJson } from "@modules/domain/mcp-gateway-receipts"

/** What a tool does to the connected system. */
export type ToolScope = "read" | "write" | "restricted"

/** A JSON value accepted at the connector argument boundary. */
export type GatewayArgument =
    | string
    | number
    | boolean
    | null
    | ReadonlyArray<GatewayArgument>
    | {
          readonly [member: string]: GatewayArgument
      }

/** One tool of a connector, without the namespace. */
export interface GatewayToolSpec {
    /** The connector's own name, for example "booking.hold". */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Read, write or restricted. */
    readonly scope: ToolScope
    /** Its JSON schema. */
    readonly inputSchema: GatewayJson
    /** The owning native tool's validator; remote tools validate their specific shape on their server. */
    readonly argumentSchema?: GatewayArgumentSchema
    /** The mode a new grant starts at. */
    readonly defaultMode: GrantMode
    /** Members masked in the audit besides the standard secret names. */
    readonly secretFields?: ReadonlyArray<string>
    /**
     * The argument a side-effect tool takes its replay key in (for example `idempotencyKey`); the gateway fills it on every call that
     * names none, so a retry or a replayed approval of the same step never acts twice.
     */
    readonly idempotencyArg?: string | undefined
    /** The NIVO capability this tool plays, when it declares one (see `CapabilityRole`). */
    readonly role?: CapabilityRole
    /**
     * True for a tool no customer conversation and no customer-facing agent may run: with a conversation or a customer audience on the caller it is hidden from search and describe,
     * and a call is refused `internal_only`, audited, before any adapter runs.
     */
    readonly internalOnly?: boolean
    /**
     * True for a tool whose answer carries text a stranger may have written (documents, messages): once it answered, a write of the
     * same turn needs a person's approval, however its grant reads, because the text may be trying to steer the agent.
     */
    readonly taints?: boolean
}

/**
 * The small vocabulary of capabilities a deterministic NIVO flow asks a workspace for, without naming any connector. A tool
 * declares its role (a remote MCP tool by `_meta["nivo/role"]` in `tools/list`, pinned with its schema hash; a native tool in its
 * manifest), and `McpGatewayService.toolForRole` finds it. Each role fixes a minimal argument and answer shape; anything else a
 * connector sends stays opaque `GatewayJson`:
 * - `identity.find` `{ channel, externalId }` -> `{ found: boolean, partyId?: string, name?: string }`
 * - `identity.upsert` `{ channel, externalId, name?, phone? }` -> `{ partyId: string }`
 * - `receivable.find` `{ reference }` (the raw payment memo; the connector parses its own format) ->
 *   `{ found: boolean, receivableId?: string, balanceVnd?: number }`
 * - `receivable.recordPayment` `{ receivableId, amountVnd, paymentRef }` -> `{ paymentId: string, duplicate?: boolean }`
 * - `payment.credits.list` `{ status?, since?, limit? }` -> `{ transactions: [{ id, amountVnd, reference, payer, status, occurredAt }] }`
 * - `payment.debits.list` (money out, for example supplier payments) takes and answers the same shapes as the credits
 * - `invoice.list` `{ since?: YYYY-MM-DD, limit? }` -> `{ invoices: [{ id, sellerTaxCode, sellerName, number, series, issuedOn,
 *   totalVnd, vatVnd, format }] }`
 */
export type CapabilityRole =
    | "identity.find"
    | "identity.upsert"
    | "receivable.find"
    | "receivable.recordPayment"
    | "payment.credits.list"
    | "payment.debits.list"
    | "invoice.list"

/** The tool a workspace plays a role with. */
export interface RoleTool {
    /** The role. */
    readonly role: CapabilityRole
    /** The full name `<connector>.<tool>` to call. */
    readonly name: string
    /** The connector key. */
    readonly connector: string
    /** The connector's display name, for the source label of what the tool answered. */
    readonly connectorName: string
}

/** Whether a workspace can play some roles now, and which connectors could play each role of the vocabulary. */
export interface RoleReadiness {
    /** True when every asked role has a usable tool (no role asked is ready). */
    readonly ready: boolean
    /** The asked roles no usable tool plays. */
    readonly missing: ReadonlyArray<CapabilityRole>
    /**
     * For every role of the vocabulary, the display names of the workspace's connectors whose catalog declares it, installed or
     * installable, approved or not: the data of "connect one of these".
     */
    readonly providers: Readonly<Record<CapabilityRole, ReadonlyArray<string>>>
}

/** The tool of a role, or the typed answer that the workspace has none (no installed, approved tool declares it). */
export type RoleResolution =
    | { readonly ok: true; readonly tool: RoleTool }
    | { readonly ok: false; readonly code: "no_capability"; readonly role: CapabilityRole }

/** The manifest of a connector: its namespace, contract and tools. */
export interface GatewayConnectorManifest {
    /** The namespace, for example "shop". */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** Native (code) or remote (MCP server). */
    readonly kind: "native" | "remote"
    /** The contract version, for example "shop-mcp@1". */
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
    /** Whether the server takes a credential and whether one is sealed in the row; never the value. Native: `none`. */
    readonly credentialState: CredentialState
    /** When the credential was last set, ISO text, or null. */
    readonly credentialSetAt: string | null
    /** The per-call limit in milliseconds, within the gateway's bounds. */
    readonly timeoutMs: number
    /**
     * The tools that may run: null for a native connector (its tools are code), else the remote tools whose live schema hash
     * equals the hash an owner or manager approved. A new or changed remote tool is not in it until it is approved.
     */
    readonly approvedTools: ReadonlySet<string> | null
    /** When its catalog was approved, ISO text, or null. */
    readonly approvedAt: string | null
    /** When it was last checked (a health check or a catalog read), ISO text, or null. */
    readonly checkedAt: string | null
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
    /**
     * Who the caller's agent talks to: `customer` for a customer-facing or publishing module (or one the catalogue does not know),
     * `internal` otherwise. A caller that does not say (a performer NIVO runs itself) is internal; the agent door always says.
     */
    readonly audience?: "customer" | "internal"
    /** The person who approved this exact call, when it replays an approval. */
    readonly approvedBy?: string
    /**
     * The stable key of the step this call is (for example `<workItemId>:<step>` or the inbound message id): a re-run of the
     * same step passes the same key. A side-effect remote call derives its replay key from it, else from the work item.
     */
    readonly opKey?: string | undefined
    /** The agent turn the call runs in (the bridge of a running turn knows it); the agent door has none. */
    readonly turnId?: string | undefined
}

/** What the grant check decided for one call. */
export type GrantVerdict =
    | { readonly kind: "allow" }
    | { readonly kind: "refuse" }
    | { readonly kind: "approval"; readonly reason: GatewayApprovalReason }

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
    readonly inputSchema: GatewayJson
    /** The caller's argument constraints. */
    readonly constraints: ReadonlyArray<ArgConstraint>
    /** The caller's amount limit, or null. */
    readonly limitVnd: number | null
}

/** A granted tool described in full, or null when it does not exist or the caller is not granted it. */
export type OptionalDescribedTool = DescribedTool | null

/** Outcome of an audited call. */
export type CallOutcome = "ok" | "error" | "refused" | "approval" | "timeout" | "circuit_open"

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
    /** `none` (the server takes no credential), `needed` (not entered yet) or `set`; the value is never read back. */
    readonly credentialState: CredentialState
    /** When the credential was last set or rotated, ISO text, or null. */
    readonly credentialSetAt: string | null
    /** The contract version. */
    readonly contractVersion: string
    /** The per-call limit. */
    readonly timeoutMs: number
    /** When its catalog was approved, ISO text, or null. */
    readonly approvedAt: string | null
    /** When it was last checked, ISO text, or null. */
    readonly checkedAt: string | null
    /** The full names of its tools with their scope, description and approval. */
    readonly tools: ReadonlyArray<ConnectorToolView>
}

/** One tool of a connector as the console lists it. */
export interface ConnectorToolView {
    /** True when the tool may run: native, or a remote tool whose live schema is the approved one. */
    readonly approved: boolean
    /** The full name. */
    readonly name: string
    /** Its scope. */
    readonly scope: ToolScope
    /** What it does. */
    readonly description: string
}

/** The state of a connector's breaker. */
export interface BreakerState {
    /** Closed (calls run), open (calls are refused) or half-open (one probe call runs, the others are refused). */
    readonly phase: BreakerPhase
    /** When the recent failures happened, epoch ms. */
    readonly failures: ReadonlyArray<number>
    /** Until when it stays open, epoch ms, or null when it is not open. */
    readonly openUntil: number | null
}

/** The phase of a connector's breaker. */
export type BreakerPhase = "closed" | "open" | "half_open"

/** What the breaker decides for one call now: whether it runs, and the state to keep. */
export interface BreakerGate {
    /** True when the call may run. */
    readonly allowed: boolean
    /** The state after the decision (an open breaker past its pause turns half-open for the one probe it lets through). */
    readonly state: BreakerState
}

/** Every native tool declares its owning domain's validator beside the advertised schema. */
export interface NativeToolSpec extends GatewayToolSpec {
    /** The required validator, also used before grants and approvals are considered. */
    readonly argumentSchema: GatewayArgumentSchema
}

/** A native connector cannot register a tool without a validator. */
export interface NativeConnectorManifest extends GatewayConnectorManifest {
    /** Native manifests are registered in code. */
    readonly kind: "native"
    /** Every tool has a bounded schema. */
    readonly tools: ReadonlyArray<NativeToolSpec>
}

/** Who a native tool runs for: the agent, and the customer conversation when the call serves one. */
export interface NativeCaller {
    /** The agent. */
    readonly agentId: string
    /** The customer conversation the call serves, or null. */
    readonly conversationId: string | null
}

/**
 * A native connector: its manifest and how it runs a tool. An adapter that needs no caller declares the three-parameter form; one
 * that answers for the agent's view (module, instance, audience) takes the caller.
 */
export interface NativeAdapter {
    /** The manifest. */
    readonly manifest: NativeConnectorManifest
    /** Runs one tool for a workspace, for the caller. An expected refusal is a `NativeRefused` error, which is an answer. */
    invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson>
}

/** The caller a request to the gateway's own endpoint proved: the agent its credential names, in the workspace it names. */
export interface SurfacePrincipal {
    /** The agent (the credential's subject). */
    readonly agentId: string
    /** The only workspace the credential acts for. */
    readonly workspaceId: string
}

/** One JSON-RPC message to the gateway endpoint of a workspace, from an authenticated agent. */
export interface SurfaceRequest {
    /** The workspace the endpoint path names. */
    readonly workspaceId: string
    /** Who the credential proved. */
    readonly principal: SurfacePrincipal
    /** The parsed JSON-RPC body. */
    readonly message: unknown
}

/** What the endpoint answers: the JSON-RPC response, or null for a notification. */
export interface SurfaceReply {
    /** The JSON-RPC response, or null. */
    readonly body: McpRpcResponse | null
}

/** Which audit lines the console reads. */
export interface CallLogQuery {
    /** The owner or manager asking, in the workspace. */
    readonly actor: ConnectionActor
    /** How many lines (1 to 200); absent or null means fifty. */
    readonly limit?: number | null | undefined
}

/** A remote connector to register. */
export interface RemoteConnectorInput {
    /** The namespace. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** The Streamable HTTP endpoint. */
    readonly url: string
    /** The bearer credential, entered once and sealed in the row at once; null / absent keeps the stored one (or none). */
    readonly credential?: string | null | undefined
    /** True when the server takes a credential even though none is entered now (it is then `needed`); absent = false. */
    readonly needsCredential?: boolean
    /** The contract version. */
    readonly contractVersion: string
    /** The per-call limit; null / absent keeps the gateway default. */
    readonly timeoutMs?: number | null | undefined
}

/** One grant to set. */
export interface GrantInput {
    /** The agent. */
    readonly agentId: string
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** The mode. */
    readonly mode: GrantMode
    /** The amount limit, or null / absent for none. */
    readonly limitVnd?: number | null | undefined
    /** The argument constraints as JSON ([{ "arg": "quantity", "max": 5 }]), or null / absent for none. */
    readonly constraintsJson?: string | null | undefined
}

/** A new bearer credential of a remote connector: its first one, or a rotation. */
export interface McpCredentialInput {
    /** The connector key. */
    readonly key: string
    /** The credential, sealed before it is stored and never read back. */
    readonly credential: Secret
}

/** The remote connector the gateway opens an endpoint to: its key, its URL and its credential state. */
export interface RemoteTarget {
    /** The connector key. */
    readonly key: string
    /** The Streamable HTTP endpoint. */
    readonly url: string
    /** The credential state of its row. */
    readonly credentialState: CredentialState
}
