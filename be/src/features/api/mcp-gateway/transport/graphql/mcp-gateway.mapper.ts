import type {
    CallLogView,
    ConnectorView,
    GrantInput,
    GrantView,
    RemoteConnectorInput,
} from "@modules/domain/mcp-gateway"
import type { McpCallLogType } from "./dto/mcp-call-log.type"
import type { McpConnectorType } from "./dto/mcp-connector.type"
import type { McpToolGrantType } from "./dto/mcp-tool-grant.type"
import type { RegisterMcpConnectorInput } from "./dto/register-mcp-connector.input"
import type { SetMcpToolGrantInput } from "./dto/set-mcp-tool-grant.input"
import type { McpCallLogInput } from "./dto/mcp-call-log.input"

/** The connectors as GraphQL types. */
export const toMcpConnectorTypes = (views: ReadonlyArray<ConnectorView>): Array<McpConnectorType> =>
    views.map(toMcpConnectorType)

/** The grants as GraphQL types. */
export const toMcpToolGrantTypes = (views: ReadonlyArray<GrantView>): Array<McpToolGrantType> =>
    views.map(toMcpToolGrantType)

/** The audit lines as GraphQL types. */
export const toMcpCallLogTypes = (views: ReadonlyArray<CallLogView>): Array<McpCallLogType> =>
    views.map(toMcpCallLogType)

/** A finished console command answers true. */
export const toMcpDone = (): boolean => true

/** A connector as the GraphQL type. */
export const toMcpConnectorType = (view: ConnectorView): McpConnectorType => ({
    ...view,
    tools: view.tools.map((tool) => ({ ...tool })),
})

/** A grant as the GraphQL type. */
export const toMcpToolGrantType = (view: GrantView): McpToolGrantType => ({
    agentId: view.agentId,
    agentName: view.agentName,
    tool: view.tool,
    mode: view.mode,
    limitVnd: view.limitVnd,
    constraintsJson: view.constraintsJson,
})

/** An audit line as the GraphQL type. */
export const toMcpCallLogType = (view: CallLogView): McpCallLogType => ({ ...view })

/** The grant input as the domain input. */
export const toGrantInput = (input: SetMcpToolGrantInput): GrantInput => ({
    agentId: input.agentId,
    tool: input.tool,
    mode: input.mode,
    limitVnd: input.limitVnd,
    constraintsJson: input.constraintsJson,
})

/** The connector input as the domain input. */
export const toRemoteConnectorInput = (input: RegisterMcpConnectorInput): RemoteConnectorInput => ({
    key: input.key,
    name: input.name,
    url: input.url,
    credentialRef: input.credentialRef,
    contractVersion: input.contractVersion,
    timeoutMs: input.timeoutMs,
})

/** The audit page request. */
export const toMcpCallLogRequest = (workspaceId: string, input: McpCallLogInput | null) => ({
    workspaceId,
    limit: input?.limit,
})
