import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { toTriggerRecord } from "./agent-work.mapper"
import { MAX_TRIGGERS } from "./agent-work.policy"
import { triggerFields } from "./agent-trigger.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTriggerEntity } from "./persistence/entities"
import type { AgentTriggerRecord, AgentTriggerWrite } from "./agent-work.contracts"

@Injectable()
/**
 * The triggers of an agent, as rows: the truth the scheduler in Redis is a projection of. This service writes rows and leaves the
 * scheduler to the road that reads them, so a row written here without a scheduler is picked up by the minute sweep, which
 * reconciles every trigger whose `reconciled_at` is empty or old. The only writer of agent_triggers.
 */
export class AgentTriggersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly access: AgentWorkAccessService,
    ) {}

    /** The triggers of an agent, oldest first. */
    async ofAgent(agentId: string): Promise<ReadonlyArray<AgentTriggerRecord>> {
        const rows = await this.entityManager.find(AgentTriggerEntity, {
            where: { agentId },
            order: { createdAt: "ASC" },
            take: MAX_TRIGGERS,
        })
        return rows.map(toTriggerRecord)
    }

    /** The enabled event triggers that name this event, at most `limit`, so an internal event wakes only the agents that asked for it. */
    async enabledForEvent(eventName: string, limit: number): Promise<ReadonlyArray<AgentTriggerRecord>> {
        const rows = await this.entityManager.find(AgentTriggerEntity, {
            where: { kind: "event", eventName, enabled: true },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map(toTriggerRecord)
    }

    /** One trigger by id, or null. */
    async byId(triggerId: string): Promise<AgentTriggerRecord | null> {
        const row = await this.entityManager.findOne(AgentTriggerEntity, { where: { id: triggerId } })
        return row === null ? null : toTriggerRecord(row)
    }

    /**
     * Writes a trigger: a clock preset (with a time of day for the daily ones) or an internal event, at most eight per agent. A member
     * (`actorUserId`) must be an owner or manager; a module seeding its triggers passes null. The row is marked unreconciled so the
     * scheduler is made to agree with it.
     */
    async save(actorUserId: string | null, write: AgentTriggerWrite): Promise<AgentTriggerRecord> {
        if (actorUserId !== null) await this.access.manager(actorUserId, write.workspaceId)
        await this.access.agent(write.workspaceId, write.agentId)
        const fields = triggerFields(write)
        if (write.triggerId === null) {
            const count = await this.entityManager.count(AgentTriggerEntity, { where: { agentId: write.agentId } })
            if (count >= MAX_TRIGGERS) {
                throw new AgentWorkError({ code: AgentWorkErrorCode.TooManyTriggers, params: { max: MAX_TRIGGERS } })
            }
            const created = await this.entityManager.save(AgentTriggerEntity, {
                workspaceId: write.workspaceId,
                agentId: write.agentId,
                ...fields,
            })
            return toTriggerRecord(created)
        }
        const updated = await this.entityManager.update(
            AgentTriggerEntity,
            { id: write.triggerId, agentId: write.agentId, workspaceId: write.workspaceId },
            { ...fields, reconciledAt: null },
        )
        if (updated.affected === 0) throw new AgentWorkError({ code: AgentWorkErrorCode.TriggerNotFound })
        const row = await this.entityManager.findOne(AgentTriggerEntity, { where: { id: write.triggerId } })
        if (row === null) throw new AgentWorkError({ code: AgentWorkErrorCode.TriggerNotFound })
        return toTriggerRecord(row)
    }

    /** Removes a trigger. The scheduler entry it leaves is dropped by the next reconcile. Owner or manager. */
    async remove(userId: string, workspaceId: string, agentId: string, triggerId: string): Promise<void> {
        await this.access.manager(userId, workspaceId)
        const removed = await this.entityManager.delete(AgentTriggerEntity, { id: triggerId, agentId, workspaceId })
        if (removed.affected === 0) throw new AgentWorkError({ code: AgentWorkErrorCode.TriggerNotFound })
    }

    /** Records that a slot fired, in the transaction that wrote its wake, with the slot the scheduler holds next. */
    async recordFire(tx: EntityManager, triggerId: string, firedAt: Date, nextRunAt: Date | null): Promise<void> {
        await tx.update(AgentTriggerEntity, { id: triggerId }, { lastFiredAt: firedAt, nextRunAt })
    }

    /** Records that the scheduler was made to agree with the row, and the next slot it holds. */
    async recordReconciled(triggerId: string, reconciledAt: Date, nextRunAt: Date | null): Promise<void> {
        await this.entityManager.update(AgentTriggerEntity, { id: triggerId }, { reconciledAt, nextRunAt })
    }
}
