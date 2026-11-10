import type { BoundConnection, ConnectionGrant } from "@modules/domain/agent-connections"
import type { AgentPage } from "@modules/domain/agent-profile"
import type { GenerationRequested, GenerationStatus } from "@modules/domain/ai-generations"
import type { AgentDashboardData, AgentSummary } from "@modules/domain/agents"
import type { Locale } from "@modules/platform/i18n"
import type { CreateAgentRequest } from "../../application/create-agent.contracts"
import type { GetAgentPageRequest } from "../../application/get-agent-page.contracts"
import type { SetAgentOwnershipRequest } from "../../application/set-agent-ownership.contracts"
import type { GetAgentDashboardRequest } from "../../application/get-agent-dashboard.contracts"
import type { GetGenerationStatusRequest } from "../../application/get-generation-status.contracts"
import type { GrantAgentConnectionRequest } from "../../application/grant-agent-connection.contracts"
import type { ListAgentConnectionsRequest } from "../../application/list-agent-connections.contracts"
import type { ListAgentsRequest } from "../../application/list-agents.contracts"
import type { RenameAgentRequest } from "../../application/rename-agent.contracts"
import type { RequestGenerationRequest } from "../../application/request-generation.contracts"
import type { RevokeAgentConnectionRequest } from "../../application/revoke-agent-connection.contracts"
import type { SetAgentStatusRequest } from "../../application/set-agent-status.contracts"
import type { SetAgentTextsRequest } from "../../application/set-agent-texts.contracts"
import type { AgentAckType } from "./dto/agent-ack.type"
import type { AgentPageType } from "./dto/agent-page.type"
import type { SetAgentOwnershipInput } from "./dto/set-agent-ownership.input"
import type { AgentConnectionType } from "./dto/agent-connection.type"
import type { ConnectionAgentGrantType } from "./dto/connection-agent-grant.type"
import type { AgentDashboardInput } from "./dto/agent-dashboard.input"
import type { AgentDashboardType } from "./dto/agent-dashboard.type"
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
import type { RevokeAgentConnectionInput } from "./dto/revoke-agent-connection.input"
import type { SetAgentStatusInput } from "./dto/set-agent-status.input"
import type { SetAgentTextsInput } from "./dto/set-agent-texts.input"


/** Maps one agent to the GraphQL type. */
export const toAgentType = (agent: AgentSummary): AgentSummaryType => ({ ...agent })

/** Maps the listing of the GraphQL input, with the workspace it names, to the query request. */
export const toListAgentsRequest = (workspaceId: string, input: ListAgentsInput): ListAgentsRequest => ({
    workspaceId,
    ...input,
})

/** Maps the agents to the GraphQL type. */
export const toAgentsType = (agents: ReadonlyArray<AgentSummary>): Array<AgentSummaryType> =>
    agents.map((agent) => ({ ...agent }))

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

/** Maps the connections granted to an agent to the GraphQL type. */
export const toAgentConnectionsType = (connections: ReadonlyArray<BoundConnection>): Array<AgentConnectionType> =>
    connections.map((connection) => ({ ...connection }))

/** Maps the agents granted each connection to the GraphQL type. */
export const toConnectionGrantsType = (grants: ReadonlyArray<ConnectionGrant>): Array<ConnectionAgentGrantType> =>
    grants.map((grant) => ({ ...grant }))

/** Maps the new agent of the GraphQL input, with the workspace it names, to the command request. */
export const toCreateAgentRequest = (workspaceId: string, input: CreateAgentInput): CreateAgentRequest => ({
    workspaceId,
    ...input,
})

/** Maps the dashboard regions to the GraphQL type. */
export const toAgentDashboardType = (result: AgentDashboardData): AgentDashboardType => ({ ...result })

/** Maps the rename of the GraphQL input, with the workspace it names, to the command request. */
export const toRenameAgentRequest = (workspaceId: string, input: RenameAgentInput): RenameAgentRequest => ({
    workspaceId,
    ...input,
})

/** Maps what queueing a text answered to the GraphQL type. */
export const toAgentGenerationRequestedType = (result: GenerationRequested): AgentGenerationRequestedType => ({
    ...result,
})

/** Maps the status change of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentStatusRequest = (workspaceId: string, input: SetAgentStatusInput): SetAgentStatusRequest => ({
    workspaceId,
    ...input,
})

/** Maps the status of a queued text to the GraphQL type. */
export const toAgentGenerationStatusType = (status: GenerationStatus): AgentGenerationStatusType => ({ ...status })

/** Maps the texts of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentTextsRequest = (workspaceId: string, input: SetAgentTextsInput): SetAgentTextsRequest => ({
    workspaceId,
    ...input,
})

/** The answer of a mutation that returns nothing else. */
export const toAgentAckType = (): AgentAckType => ({ ok: true })

/** Maps the grant of the GraphQL input, with the workspace it names, to the command request. */
export const toGrantAgentConnectionRequest = (
    workspaceId: string,
    input: GrantAgentConnectionInput,
): GrantAgentConnectionRequest => ({
    workspaceId,
    agentId: input.agentId,
    connectionId: input.connectionId,
    purpose: input.purpose,
})

/** Maps the revocation of the GraphQL input, with the workspace it names, to the command request. */
export const toRevokeAgentConnectionRequest = (
    workspaceId: string,
    input: RevokeAgentConnectionInput,
): RevokeAgentConnectionRequest => ({ workspaceId, ...input })

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

/** Maps the agent of the GraphQL input, with the workspace it names, to the page query request. */
export const toAgentPageRequest = (workspaceId: string, input: AgentIdInput): GetAgentPageRequest => ({
    workspaceId,
    ...input,
})

/** Maps the agent page to the GraphQL type. */
export const toAgentPageType = (page: AgentPage): AgentPageType => ({ ...page })

/** Maps the ownership of the GraphQL input, with the workspace it names, to the command request. */
export const toSetAgentOwnershipRequest = (
    workspaceId: string,
    input: SetAgentOwnershipInput,
): SetAgentOwnershipRequest => ({ workspaceId, ...input })
