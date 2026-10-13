import type { ConnectionCandidate } from "@modules/domain/connection-grants"
import type { AgentConnectionCandidatesRequest } from "../../application/agent-connection-candidates.contracts"
import type { AgentConnectionCandidateType } from "./dto/agent-connection-candidate.type"
import type { AgentConnectionCandidatesInput } from "./dto/agent-connection-candidates.input"

/** Maps the GraphQL arguments of agentConnectionCandidates to the request. */
export const toAgentConnectionCandidatesRequest = (
    workspaceId: string,
    input: AgentConnectionCandidatesInput,
): AgentConnectionCandidatesRequest => ({
    workspaceId,
    agentId: input.agentId,
})

/** Maps the grantable connections to the GraphQL type. */
export const toAgentConnectionCandidatesType = (
    candidates: ReadonlyArray<ConnectionCandidate>,
): Array<AgentConnectionCandidateType> => candidates.map((candidate) => ({ ...candidate }))
