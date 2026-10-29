import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EngineStatusService } from "@modules/domain/agents"
import type { EngineStatus } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

@Injectable()
/** Read-only view of when the agent copies of a workspace were last checked, for the capabilities that show it. */
export class AgentSyncChecksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly engine: EngineStatusService,
    ) {}

    /** The engine status for the Agents page: membership is proved first, then the latest check time of the workspace's copies is read. */
    engineStatus(userId: string, workspaceId: string): Promise<EngineStatus> {
        return this.engine.status(userId, workspaceId, () => this.lastCheckAt(workspaceId))
    }

    /** The latest check time of the workspace's agent copies as ISO text, or null when none was ever checked. */
    async lastCheckAt(workspaceId: string): Promise<string | null> {
        const latest = await this.entityManager.findOne(OpenclawAgentSyncEntity, {
            select: { checkedAt: true },
            where: { workspaceId },
            order: { checkedAt: "DESC" },
        })
        return latest === null ? null : latest.checkedAt.toISOString()
    }
}
