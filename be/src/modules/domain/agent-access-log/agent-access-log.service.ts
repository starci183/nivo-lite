import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AccessChange } from "./agent-access-log.contracts"
import { INSERT_AGENT_ACCESS_LOG } from "./persistence/agent-access-log.sql"

@Injectable()
/** Owns the access log: the one writer of agent_access_log, joining the transaction that changes the access. */
export class AgentAccessLogService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Records one change of access inside the caller's transaction when one is handed in. */
    async record(change: AccessChange, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(INSERT_AGENT_ACCESS_LOG, [
            change.workspaceId,
            change.connectionId,
            change.agentId,
            change.connectionName,
            change.agentName,
            change.before,
            change.after,
            change.changedBy,
            change.changedByName,
        ])
    }
}
