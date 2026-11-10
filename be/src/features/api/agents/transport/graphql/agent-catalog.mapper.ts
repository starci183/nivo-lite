import type { CatalogAgent } from "@modules/domain/agents"
import type { ListAgentCatalogRequest } from "../../application/list-agent-catalog.contracts"
import type { AgentCatalogEntryType } from "./dto/agent-catalog-entry.type"

/** Maps the workspace of the call to the catalog query request. */
export const toListAgentCatalogRequest = (workspaceId: string): ListAgentCatalogRequest => ({ workspaceId })

/** Maps the catalog entries to the GraphQL type. */
export const toAgentCatalogType = (agents: ReadonlyArray<CatalogAgent>): Array<AgentCatalogEntryType> =>
    agents.map((agent) => ({
        agentId: agent.agentId,
        installationId: agent.installationId,
        grants: agent.grants.map((grant) => ({ ...grant })),
        knowledge: { ...agent.knowledge },
    }))
