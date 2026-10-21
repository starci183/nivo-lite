import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewAgent } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import type { IdRow } from "./persistence/agents.rows"
import { UPSERT_AGENT_BY_HANDLE } from "./persistence/agent-records.sql"

@Injectable()
/**
 * The agent rows a configuration run keeps by handle, over the entity manager alone so the cli can compose it without the
 * OpenClaw engine. The caller has already proven the workspace owner; the Agents pages keep using AgentsService.
 */
export class AgentRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Inserts the agent, or updates the one that already has its handle, and answers its id. */
    async ensureByHandle(agent: NewAgent): Promise<string> {
        const [row] = await this.entityManager.query<Array<IdRow>>(UPSERT_AGENT_BY_HANDLE, [
            agent.workspaceId,
            agent.module,
            agent.name,
            agent.handle,
            agent.role,
            agent.instructions,
        ])
        if (row === undefined) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        return row.id
    }
}
