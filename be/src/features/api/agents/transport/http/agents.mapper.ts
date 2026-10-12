import type { BoundConnection } from "@modules/domain/agent-connections"
import type { AgentDashboardData, AgentSummary, EngineStatus } from "@modules/domain/agents"
import type { GenerationOutcome } from "@modules/domain/ai-generations"
import type { GenerateTextRequest as GenerateTextCommandRequest } from "../../application/generate-text.contracts"
import type { GetAgentDashboardRequest } from "../../application/get-agent-dashboard.contracts"
import type { RequestAgentSyncRequest as RequestAgentSyncCommandRequest } from "../../application/request-agent-sync.contracts"
import type { AgentConnectionResponse } from "./dto/agent-connection.response"
import type { AgentDashboardRequest } from "./dto/agent-dashboard.request"
import type { AgentDashboardResponse } from "./dto/agent-dashboard.response"
import type { AgentSummaryResponse } from "./dto/agent.response"
import type { EngineStatusResponse } from "./dto/engine-status.response"
import type { GenerateTextRequest } from "./dto/generate-text.request"
import type { GenerationResponse } from "./dto/generation.response"
import type { RequestAgentSyncRequest } from "./dto/request-agent-sync.request"

/** Maps the agents to the HTTP response. */
export const toAgentsResponse = (result: ReadonlyArray<AgentSummary>): Array<AgentSummaryResponse> =>
    result.map((agent) => ({ ...agent }))

/** Maps one agent to the HTTP response. */
export const toAgentResponse = (result: AgentSummary): AgentSummaryResponse => ({ ...result })

/** Maps the dashboard query of the HTTP request, with the workspace it names, to the application request. */
export const toDashboardRequest = (workspaceId: string, input: AgentDashboardRequest): GetAgentDashboardRequest => ({
    workspaceId,
    module: input.module,
    installationId: input.installationId,
})

/** Maps the dashboard regions to the HTTP response. */
export const toDashboardResponse = (result: AgentDashboardData): AgentDashboardResponse => ({ ...result })

/** Maps the engine status to the HTTP response. */
export const toEngineStatusResponse = (result: EngineStatus): EngineStatusResponse => ({ ...result })

/** Maps the sync request of the HTTP request, with the workspace it names, to the application request. */
export const toSyncRequest = (workspaceId: string, input: RequestAgentSyncRequest): RequestAgentSyncCommandRequest => ({
    workspaceId,
    installationId: input.installationId,
    force: input.force,
})

/** Maps the generation request of the HTTP request, with the workspace it names, to the application request. */
export const toGenerateRequest = (workspaceId: string, input: GenerateTextRequest): GenerateTextCommandRequest => ({
    workspaceId,
    purpose: input.purpose,
    messages: input.messages,
    responseFormat: input.responseFormat,
    timeoutMs: input.timeoutMs,
    kind: input.kind,
    module: input.module,
})

/** Maps the generation outcome to the HTTP response. */
export const toGenerationResponse = (result: GenerationOutcome): GenerationResponse => ({ ...result })

/** Maps the connections granted to an agent to the HTTP response. */
export const toAgentConnectionsResponse = (result: ReadonlyArray<BoundConnection>): Array<AgentConnectionResponse> =>
    result.map((connection) => ({ ...connection }))
