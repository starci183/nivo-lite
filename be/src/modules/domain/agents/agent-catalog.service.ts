import { Injectable } from "@nestjs/common"
import type { CatalogAgent, CatalogKnowledge } from "./agent-catalog.contracts"
import { catalogAgentOf, catalogKnowledgeOf } from "./agent-catalog.policy"
import { InjectAgentConnections, InjectInstallations, InjectKnowledge } from "./agents.decorators"
import type { AgentSummary } from "./agents.contracts"
import type { AgentConnectionsDirectory, InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"

@Injectable()
/**
 * What the agent catalog lists per agent, in one read: the connections granted to it (one query for all agents) and what its lens
 * reads of the shared knowledge (documents, approved and waiting facts). The lens is the one the agent really reads through, so the
 * catalog can never drift from the Brain. Any member may look.
 */
export class AgentCatalogService {
    constructor(
        private readonly agents: AgentsService,
        @InjectAgentConnections() private readonly bindings: AgentConnectionsDirectory,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectKnowledge() private readonly knowledge: KnowledgeLens,
    ) {}

    /** The catalog entry of every agent of the workspace, oldest first. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<CatalogAgent>> {
        const agents = await this.agents.list(userId, workspaceId)
        const grants = await this.bindings.connectionsOfAgents(
            userId,
            workspaceId,
            agents.map((agent) => agent.id),
        )
        return Promise.all(
            agents.map(async (agent) => {
                const installationId = (await this.installations.ofAgent(workspaceId, agent.id))?.id ?? null
                const knowledge = await this.knowledgeOf(workspaceId, agent, installationId)
                return catalogAgentOf(agent.id, installationId, grants, knowledge)
            }),
        )
    }

    private async knowledgeOf(
        workspaceId: string,
        agent: AgentSummary,
        installationId: string | null,
    ): Promise<CatalogKnowledge> {
        const [counts, waiting] = await Promise.all([
            this.knowledge.countsFor(workspaceId, agent.module, installationId),
            this.knowledge.waitingFactsOf(workspaceId, agent.module, installationId),
        ])
        return catalogKnowledgeOf(counts, waiting)
    }
}
