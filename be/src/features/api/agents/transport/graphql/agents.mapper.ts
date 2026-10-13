import type { BoundConnection } from "@modules/domain/agent-connections"
import type { GenerationRequested, GenerationStatus } from "@modules/domain/ai-generations"
import type { AgentDashboardData, AgentSummary, EngineStatus } from "@modules/domain/agents"
import type { Locale } from "@modules/platform/i18n"
import type { CreateAgentRequest } from "../../application/create-agent.contracts"
import type { GetAgentDashboardRequest } from "../../application/get-agent-dashboard.contracts"
import type { GetGenerationStatusRequest } from "../../application/get-generation-status.contracts"
import type { GetEngineStatusRequest } from "../../application/get-engine-status.contracts"
import type { GrantAgentConnectionRequest } from "../../application/grant-agent-connection.contracts"
import type { ListAgentConnectionsRequest } from "../../application/list-agent-connections.contracts"
import type { ListAgentsRequest } from "../../application/list-agents.contracts"
import type { RenameAgentRequest } from "../../application/rename-agent.contracts"
import type { RequestGenerationRequest } from "../../application/request-generation.contracts"
import type { RequestAgentSyncRequest } from "../../application/request-agent-sync.contracts"
import type { RevokeAgentConnectionRequest } from "../../application/revoke-agent-connection.contracts"
import type { SetAgentStatusRequest } from "../../application/set-agent-status.contracts"
import type { SetAgentTextsRequest } from "../../application/set-agent-texts.contracts"
import type { AgentAckType } from "./dto/agent-ack.type"
import type { AgentConnectionType } from "./dto/agent-connection.type"
import type { AgentDashboardInput } from "./dto/agent-dashboard.input"
import type { AgentDashboardType } from "./dto/agent-dashboard.type"
import type { AgentEngineStatusType } from "./dto/agent-engine-status.type"
import type { AgentGenerationIdInput } from "./dto/agent-generation-id.input"
import type { AgentGenerationRequestedType } from "./dto/agent-generation-requested.type"
import type { AgentGenerationStatusType } from "./dto/agent-generation-status.type"
import type { AgentIdInput } from "./dto/agent-id.input"
import type { AgentSummaryType } from "./dto/agent-summary.type"
import type { CreateAgentInput } from "./dto/create-agent.input"
import type { GrantAgentConnectionInput } from "./dto/grant-agent-connection.input"
import type { ListAgentsInput } from "./dto/list-agents.input"
import type { RenameAgentInput } from "./dto/rename-agent.input"
import type { RequestAgentGenerationInput } from "./dto/request-agent-generation.input"
import type { RequestAgentSyncInput } from "./dto/request-agent-sync.input"
import type { RevokeAgentConnectionInput } from "./dto/revoke-agent-connection.input"
import type { SetAgentStatusInput } from "./dto/set-agent-status.input"
import type { SetAgentTextsInput } from "./dto/set-agent-texts.input"

/** Maps the workspace of the request to the engine status request. */
export const toWorkspaceRequest = (workspaceId: string): GetEngineStatusRequest => ({ workspaceId })

/** Maps the listing of the GraphQL input, with the workspace it names, to the query request. */
export const toListAgentsRequest = (workspaceId: string, input: ListAgentsInput): ListAgentsRequest => ({
    workspaceId,
    ...input,
})

/** Maps the dashboard input, with the workspace it names, to the query request. */
export const toDashboardRequest = (workspaceId: string, input: AgentDashboardInput): GetAgentDashboardRequest => ({
    workspaceId,
    ...input,
})

/** Maps the agent of the GraphQL input, with the workspace it names, to the connections query request. */
export const toListAgentConnectionsRequest = (
    workspaceId: string,
    input: AgentIdInput,
): ListAgentConnectionsRequest => ({ workspaceId, ...input })

/** Maps the new agent of the GraphQL input, with the workspace it names, to the command request. */
export const toCreateAgentRequest = (workspaceId: string, input: CreateAgentInput): CreateAgentRequest => ({
    workspaceId,
    ...input,
})

/** Maps the rename of the GraphQL input, with the workspace it names, to the command request. */
export const toRenameAgentRequest = (workspaceId: string, input: RenameAgentInput): RenameAgentRequest => ({
    workspaceId,
    ...input,
})

/** Maps the status change of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentStatusRequest = (workspaceId: string, input: SetAgentStatusInput): SetAgentStatusRequest => ({
    workspaceId,
    ...input,
})

/** Maps the texts of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentTextsRequest = (workspaceId: string, input: SetAgentTextsInput): SetAgentTextsRequest => ({
    workspaceId,
    ...input,
})

/** Maps the sync request of the GraphQL input, with the workspace it names, to the command request. */
export const toRequestAgentSyncRequest = (
    workspaceId: string,
    input: RequestAgentSyncInput,
): RequestAgentSyncRequest => ({ workspaceId, ...input })

/** Maps the grant of the GraphQL input, with the workspace it names, to the command request. */
export const toGrantAgentConnectionRequest = (
    workspaceId: string,
    input: GrantAgentConnectionInput,
): GrantAgentConnectionRequest => ({ workspaceId, ...input })

/** Maps the revocation of the GraphQL input, with the workspace it names, to the command request. */
export const toRevokeAgentConnectionRequest = (
    workspaceId: string,
    input: RevokeAgentConnectionInput,
): RevokeAgentConnectionRequest => ({ workspaceId, ...input })

/** Maps one agent to the GraphQL type. */
export const toAgentType = (agent: AgentSummary): AgentSummaryType => ({ ...agent })

/** Maps the agents to the GraphQL type. */
export const toAgentsType = (agents: ReadonlyArray<AgentSummary>): Array<AgentSummaryType> =>
    agents.map((agent) => ({ ...agent }))

/** Maps the engine status to the GraphQL type. */
export const toAgentEngineStatusType = (status: EngineStatus): AgentEngineStatusType => ({ ...status })

/** Maps the connections granted to an agent to the GraphQL type. */
export const toAgentConnectionsType = (connections: ReadonlyArray<BoundConnection>): Array<AgentConnectionType> =>
    connections.map((connection) => ({ ...connection }))

/** Maps the dashboard regions to the GraphQL type. */
export const toAgentDashboardType = (result: AgentDashboardData): AgentDashboardType => ({ ...result })

/** The answer of a mutation that returns nothing else. */
/** Maps the generation request of the GraphQL input, with the workspace and the locale, to the command request. */
export const toRequestGenerationRequest = (
    workspaceId: string,
    input: RequestAgentGenerationInput,
    locale: Locale,
): RequestGenerationRequest => ({ workspaceId, locale, ...input })

/** Maps the id of the GraphQL input, with the workspace it names, to the status query request. */
export const toGetGenerationStatusRequest = (
    workspaceId: string,
    input: AgentGenerationIdInput,
): GetGenerationStatusRequest => ({ workspaceId, ...input })

/** Maps what queueing a text answered to the GraphQL type. */
export const toAgentGenerationRequestedType = (result: GenerationRequested): AgentGenerationRequestedType => ({
    ...result,
})

/** Maps the status of a queued text to the GraphQL type. */
export const toAgentGenerationStatusType = (status: GenerationStatus): AgentGenerationStatusType => ({ ...status })

/** The answer of a mutation that returns nothing else. */
export const toAgentAckType = (): AgentAckType => ({ ok: true })
