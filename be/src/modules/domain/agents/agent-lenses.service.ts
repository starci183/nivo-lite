import { Injectable } from "@nestjs/common"
import type { AgentKnowledgeLens, LensCell, LensCounts, LensLanes } from "./agents.contracts"
import { InjectInstallations, InjectKnowledge } from "./agents.decorators"
import type { InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"

/** How many items a view reads of each kind of knowledge, or null when they are not counted. */
const countsOf = (counts: LensCounts | null): Readonly<Record<keyof LensLanes, number | null>> => ({
    documentPublic: counts?.documents.public ?? null,
    documentInternal: counts?.documents.internal ?? null,
    factPublic: counts?.facts.public ?? null,
    factInternal: counts?.facts.internal ?? null,
    factRestricted: counts?.facts.restricted ?? null,
})

/** What one view reads of each kind of knowledge, in the order a person reads them. */
const cellsOf = (lanes: LensLanes, counts: LensCounts | null): ReadonlyArray<LensCell> => {
    const numbers = countsOf(counts)
    return [
        { lane: "documentPublic", isOpen: lanes.documentPublic, count: numbers.documentPublic },
        { lane: "documentInternal", isOpen: lanes.documentInternal, count: numbers.documentInternal },
        { lane: "factPublic", isOpen: lanes.factPublic, count: numbers.factPublic },
        { lane: "factInternal", isOpen: lanes.factInternal, count: numbers.factInternal },
        { lane: "factRestricted", isOpen: lanes.factRestricted, count: numbers.factRestricted },
    ]
}

@Injectable()
/**
 * What each view of the shared knowledge reads: the customer's, then the one of every active agent through its own module and
 * instance. The policy that builds the agent's view answers; this only asks it, so the page that shows the matrix can never drift
 * from what an agent really reads. Any member may look.
 */
export class AgentLensesService {
    constructor(
        private readonly agents: AgentsService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectKnowledge() private readonly knowledge: KnowledgeLens,
    ) {}

    /** The customer's view, then the view of every active agent, oldest first. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<AgentKnowledgeLens>> {
        const agents = (await this.agents.list(userId, workspaceId)).filter((agent) => agent.status === "active")
        const customer: AgentKnowledgeLens = {
            kind: "customer",
            agentId: null,
            installationId: null,
            module: null,
            name: null,
            avatarUrl: null,
            audience: "customer",
            cells: cellsOf(this.knowledge.customerLanes(), null),
        }
        const views = await Promise.all(
            agents.map(async (agent): Promise<AgentKnowledgeLens> => {
                const installationId = (await this.installations.ofAgent(workspaceId, agent.id))?.id ?? null
                const counts = await this.knowledge.countsFor(workspaceId, agent.module, installationId)
                return {
                    kind: "agent",
                    agentId: agent.id,
                    installationId,
                    module: agent.module,
                    name: agent.name,
                    avatarUrl: agent.avatarUrl,
                    audience: counts.audience,
                    cells: cellsOf(this.knowledge.lanesOf(agent.module), counts),
                }
            }),
        )
        return [customer, ...views]
    }
}
