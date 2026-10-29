import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalCheckTime } from "./openclaw-agent-sync.contracts"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

@Injectable()
/** Read-only view of when the agent copies of a workspace were last checked, for the capabilities that show it. */
export class AgentSyncChecksService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The latest check time of the workspace's agent copies as ISO text, or null when none was ever checked. */
    async lastCheckAt(workspaceId: string): Promise<OptionalCheckTime> {
        const latest = await this.entityManager.findOne(OpenclawAgentSyncEntity, {
            select: { checkedAt: true },
            where: { workspaceId },
            order: { checkedAt: "DESC" },
        })
        return latest === null ? null : latest.checkedAt.toISOString()
    }
}
