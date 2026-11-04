import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "./modules.service"
import { tagGrantsOf } from "./policies/instance.policy"

@Injectable()
/**
 * Grants the tag rights a module lists (`ModuleDefinition.tags`) to the agents of a workspace: the agent of the module may tag the agents of
 * the modules it lists, and the agents of the modules that list it may tag it. Every way an agent comes to be installed (the install door,
 * the seed of the agent graphs, the profile seed) calls it with the agent it installed, so no path leaves an agent that cannot hand work on.
 * A right already held is kept, so calling it again is harmless.
 */
export class ModuleTagGrantsService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly catalog: ModulesService,
        private readonly agents: AgentsService,
    ) {}

    /** Grants the rights between the agent of `moduleKey` and the agents already installed in the workspace. */
    async grantFor(workspaceId: string, moduleKey: string, agentId: string): Promise<void> {
        const module = await this.catalog.find(moduleKey)
        const peers = (await this.installations.list(workspaceId)).flatMap((record) =>
            record.agentId === null ? [] : [{ agentId: record.agentId, moduleKey: record.moduleKey }],
        )
        const peerModules = await Promise.all(
            [...new Set(peers.map((peer) => peer.moduleKey))].map((key) => this.catalog.find(key)),
        )
        const tagsOf = (key: string): ReadonlyArray<string> =>
            peerModules.filter((peer) => peer.key === key).flatMap((peer) => peer.tags ?? [])
        await this.agents.grantTags(workspaceId, tagGrantsOf(module, agentId, peers, tagsOf))
    }
}
