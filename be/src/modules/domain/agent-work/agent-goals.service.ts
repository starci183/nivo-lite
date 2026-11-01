import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { toGoalRecord } from "./agent-work.mapper"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentGoalEntity } from "./persistence/entities"
import type { AgentGoalRecord, AgentGoalWrite, OptionalActorId } from "./agent-work.contracts"

/** The most goals a list shows. */
const GOALS_MAX = 50

@Injectable()
/** The goals of an agent: what an owner, a module or the agent itself wants it to keep working toward. The only writer of agent_goals. */
export class AgentGoalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
    ) {}

    /** The goals still alive (active and paused), newest first. */
    async alive(agentId: string): Promise<ReadonlyArray<AgentGoalRecord>> {
        const rows = await this.entityManager.find(AgentGoalEntity, {
            where: { agentId, status: In(["active", "paused"]) },
            order: { createdAt: "DESC" },
            take: GOALS_MAX,
        })
        return rows.map(toGoalRecord)
    }

    /**
     * Writes a goal. A member (`actorUserId`) must be an owner or manager of the workspace; a module or the runtime passes null and
     * acts as the system. The agent must belong to the workspace.
     */
    async save(actorUserId: OptionalActorId, write: AgentGoalWrite): Promise<AgentGoalRecord> {
        const memberId =
            actorUserId === null ? write.memberId : await this.access.manager(actorUserId, write.workspaceId)
        await this.access.agent(write.workspaceId, write.agentId)
        const fields = {
            title: write.title,
            detail: write.detail,
            status: write.status,
            source: write.source,
            dueAt: write.dueAt,
        }
        if (write.goalId === null) {
            const created = await this.entityManager.save(AgentGoalEntity, {
                workspaceId: write.workspaceId,
                agentId: write.agentId,
                createdByMember: memberId,
                ...fields,
            })
            return toGoalRecord(created)
        }
        const updated = await this.entityManager.update(
            AgentGoalEntity,
            { id: write.goalId, agentId: write.agentId, workspaceId: write.workspaceId },
            fields,
        )
        if (updated.affected === 0) throw new AgentWorkError({ code: AgentWorkErrorCode.GoalNotFound })
        return this.goal(write.workspaceId, write.agentId, write.goalId)
    }

    /** Notes that the agent looked at its goals now, so the `tasks_due` probe stops waking it for the same ones. */
    async markReviewed(agentId: string, goalIds: ReadonlyArray<string>): Promise<void> {
        if (goalIds.length === 0) return
        await this.entityManager.update(
            AgentGoalEntity,
            { agentId, id: In([...goalIds]) },
            { reviewedAt: this.clock.now() },
        )
    }

    private async goal(workspaceId: string, agentId: string, goalId: string): Promise<AgentGoalRecord> {
        const row = await this.entityManager.findOne(AgentGoalEntity, { where: { id: goalId, agentId, workspaceId } })
        if (row === null) throw new AgentWorkError({ code: AgentWorkErrorCode.GoalNotFound })
        return toGoalRecord(row)
    }
}
