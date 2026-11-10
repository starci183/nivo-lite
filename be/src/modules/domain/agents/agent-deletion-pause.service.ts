import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentEntity } from "./persistence/entities"

@Injectable()
/** The agents of a workspace its owner deleted: paused together, and resumed together when the owner restores it. */
export class AgentDeletionPauseService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Pauses every running agent of the workspace, marked as paused by the deletion; answers how many it paused. */
    async pauseAll(workspaceId: string): Promise<number> {
        const result = await this.entityManager.update(
            AgentEntity,
            { workspaceId, status: "active" },
            { status: "paused", pausedByDeletion: true },
        )
        return result.affected ?? 0
    }

    /** Resumes exactly the agents the deletion paused (an agent a person paused before stays paused); answers how many it resumed. */
    async resumeAll(workspaceId: string): Promise<number> {
        const result = await this.entityManager.update(
            AgentEntity,
            { workspaceId, pausedByDeletion: true },
            { status: "active", pausedByDeletion: false },
        )
        return result.affected ?? 0
    }
}
