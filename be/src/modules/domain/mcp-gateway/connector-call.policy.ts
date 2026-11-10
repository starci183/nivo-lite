import { McpError, McpErrorCode } from "@modules/integrations/mcp"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type {
    CapabilityRole,
    GatewayCaller,
    GatewayJson,
    GatewayToolSpec,
    OptionalToolName,
    RoleResolution,
    WorkspaceConnector,
} from "./mcp-gateway.contracts"
import { fullNameOf } from "./tool-name.policy"

/** True when the connector may run the tool: a native tool, or a remote tool whose live schema is the approved one. */
export const usable = (connector: WorkspaceConnector, tool: string): boolean =>
    connector.approvedTools === null || connector.approvedTools.has(tool)

/**
 * True when the caller may see the tool: a tool for internal use is hidden from a customer-facing agent always, and from a customer
 * conversation unless the call is a workflow step (`graphStep`), whose conversation is only the one its run carries: the step of an
 * internal agent (the accounting step that writes the books) keeps its internal tools whoever started the run.
 */
export const toolVisibleTo = (caller: GatewayCaller, spec: GatewayToolSpec): boolean =>
    spec.internalOnly !== true ||
    (caller.audience !== "customer" && (caller.conversationId === null || caller.graphStep === true))

/**
 * The tool of a role among connectors: the first tool declaring it among those not disabled (natives first, then remotes by
 * key) that may run; none is `no_capability`.
 */
export const roleIn = (connectors: ReadonlyArray<WorkspaceConnector>, role: CapabilityRole): RoleResolution => {
    const [tool] = connectors
        .filter((connector) => connector.status !== "disabled")
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.role === role && usable(connector, spec.name))
                .map((spec) => ({
                    role,
                    name: fullNameOf(connector.manifest.key, spec.name),
                    connector: connector.manifest.key,
                    connectorName: connector.manifest.name,
                })),
        )
    return tool === undefined ? { ok: false, code: "no_capability", role } : { ok: true, tool }
}

/**
 * The full tool name that plays a domain tool among connectors: the first tool declaring the domain among those not disabled
 * (natives first, then remotes by key) that may run; null when the workspace has none.
 */
export const domainNameIn = (connectors: ReadonlyArray<WorkspaceConnector>, domain: string): OptionalToolName => {
    const [name] = connectors
        .filter((connector) => connector.status !== "disabled")
        .flatMap((connector) =>
            connector.manifest.tools
                .filter((spec) => spec.domain === domain && usable(connector, spec.name))
                .map((spec) => fullNameOf(connector.manifest.key, spec.name)),
        )
    return name ?? null
}

/** True for the gateway's own time-limit errors and the remote client's. */
export const isTimeout = (cause: unknown): boolean =>
    (cause instanceof McpError && cause.code === McpErrorCode.Timeout) ||
    (cause instanceof McpGatewayError && cause.code === McpGatewayErrorCode.Timeout)

/** The answer of a native adapter that refused an expected case (its reason), or null for any other failure. */
export const refusalOf = (cause: unknown): GatewayJson | null =>
    cause instanceof McpGatewayError && cause.code === McpGatewayErrorCode.NativeRefused
        ? { error: String(cause.params["reason"] ?? "refused") }
        : null

/** The code a failed run is audited with. */
export const failureCodeOf = (cause: unknown): string =>
    cause instanceof McpError || cause instanceof McpGatewayError ? cause.code : "internal"
