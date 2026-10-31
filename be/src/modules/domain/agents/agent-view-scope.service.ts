import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalAgentViewScope } from "./agent-directory.contracts"
import { AgentEntity } from "./persistence/entities"

/** The row `lensOf` reads: the agent's module and the installation that drives it, if any. */
interface AgentViewRow {
    readonly module: string
    readonly installation_id: string | null
    readonly is_multi: boolean | null
}

@Injectable()
/** Reads what bounds the view of an agent's knowledge, for the capabilities that read the Brain on behalf of an agent. */
export class AgentViewScopeService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The scope of the view of an agent's knowledge: its module, and the installation when the agent is one instance of a type that
     * allows several (a single-instance agent reads the shared knowledge only). Null when the workspace has no such agent.
     */
    async lensOf(workspaceId: string, agentId: string): Promise<OptionalAgentViewScope> {
        const row = await this.entityManager
            .createQueryBuilder(AgentEntity, "a")
            .select("a.module", "module")
            .addSelect("i.id", "installation_id")
            .addSelect("i.is_multi", "is_multi")
            .leftJoin("module_installations", "i", "i.agent_id = a.id AND i.workspace_id = a.workspace_id")
            .where("a.workspaceId = :workspaceId AND a.id = :agentId", { workspaceId, agentId })
            .getRawOne<AgentViewRow>()
        if (row === undefined) return null
        return { module: row.module, installationId: row.is_multi === true ? row.installation_id : null }
    }
}
