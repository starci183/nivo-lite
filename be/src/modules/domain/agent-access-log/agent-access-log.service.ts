import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AccessChange } from "./agent-access-log.contracts"
import { AgentAccessLogEntity } from "./persistence/entities"

@Injectable()
/** Owns the access log: the one writer of agent_access_log, joining the transaction that changes the access. */
export class AgentAccessLogService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Records one change of access inside the caller's transaction when one is handed in. */
    async record(change: AccessChange, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.insert(AgentAccessLogEntity, {
            workspaceId: change.workspaceId,
            connectionId: change.connectionId,
            agentId: change.agentId,
            connectionName: change.connectionName,
            agentName: change.agentName,
            beforeAccess: change.before,
            afterAccess: change.after,
            changedBy: change.changedBy,
            changedByName: change.changedByName,
        })
    }
}
