import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { INSTALLED, inboundChannelsOf } from "@modules/domain/installed-plugins"
import type { RequirementFacts } from "@modules/domain/module-installations"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"

/** How many connected providers are read at once. */
const PROVIDERS_LIMIT = 200

/** The modules whose active agents count as chat agents: the template agents a customer writes to (a graph wakes on a customer message). */
const chatModules = (): ReadonlyArray<string> =>
    INSTALLED.templateAgents()
        .filter((agent) => inboundChannelsOf(agent).size > 0)
        .map((agent) => agent.key)

@Injectable()
/** What surrounds an installation and lives in other capabilities, asked of each owner: what the workspace has for a module's requirements. */
export class InstallationFactsService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly agents: AgentDirectoryService,
        private readonly staff: StaffDirectoryService,
        private readonly members: WorkspaceMembersReadService,
    ) {}

    /** What the workspace has for the requirements of a module: connected providers and head counts. */
    async requirementFacts(workspaceId: string): Promise<RequirementFacts> {
        const [providers, chatAgents, staff, members] = await Promise.all([
            this.connections.connectedProviders(workspaceId, PROVIDERS_LIMIT),
            this.agents.activeCountOfModules(workspaceId, chatModules()),
            this.staff.activeCount(workspaceId),
            this.members.activeCount(workspaceId),
        ])
        return { providers, chatAgents, staff, members }
    }
}
