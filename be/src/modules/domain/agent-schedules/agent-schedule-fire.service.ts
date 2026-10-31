import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTriggersService, AgentWakeService } from "@modules/domain/agent-work"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueSchedules } from "@modules/platform/queue"
import type { QueueSchedules } from "@modules/platform/queue"
import { AGENT_SCHEDULE_FIRE_QUEUE, agentTriggerSchedulerId, isAgentScheduleFirePayload } from "@modules/queues/agent-turn"
import { AgentSchedulesError, AgentSchedulesErrorCode } from "./errors/agent-schedules.error"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"

@Injectable()
/**
 * What one slot of a trigger does: it enters the one road as a `schedule` wake keyed by `<triggerId>:<slot>`, so the dedupe holds even
 * when the sweep and Redis both name the same slot. A trigger that is gone or off removes its own scheduler, and one whose work is
 * switched off is made to agree with that, so a quiet agent keeps nothing in Redis.
 */
export class AgentScheduleFireService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueSchedules() private readonly schedules: QueueSchedules,
        @InjectLogger() private readonly logger: Logger,
        private readonly triggers: AgentTriggersService,
        private readonly wakes: AgentWakeService,
        private readonly sync: AgentTriggerSyncService,
    ) {}

    /**
     * Fires the slot a fire job names; a payload without a trigger and a slot ends the job. Answers false when the slot wrote no wake
     * because the trigger was gone, off or switched off.
     */
    async fire(job: object): Promise<boolean> {
        if (!isAgentScheduleFirePayload(job)) {
            throw new AgentSchedulesError({
                code: AgentSchedulesErrorCode.FirePayloadInvalid,
                params: { unrecoverable: 1 },
            })
        }
        const payload = job
        const slot = payload.slot
        const trigger = await this.triggers.byId(payload.triggerId)
        if (trigger === null || !trigger.enabled || trigger.kind !== "schedule") {
            await this.sync.unschedule(payload.triggerId)
            this.logger.warn(AgentSchedulesLogEvent.OrphanUnscheduled, { triggerId: payload.triggerId })
            return false
        }
        if (!(await this.sync.workIsOn(payload.workspaceId, trigger.agentId))) {
            await this.sync.reconcile(payload.workspaceId, trigger)
            return false
        }
        const next = await this.schedules.nextOf(AGENT_SCHEDULE_FIRE_QUEUE, agentTriggerSchedulerId(trigger.id))
        await this.entityManager.transaction(async (tx) => {
            await this.wakes.wake(tx, {
                workspaceId: payload.workspaceId,
                agentId: trigger.agentId,
                source: "schedule",
                eventKey: `${trigger.id}:${slot}`,
                context: {
                    triggerId: trigger.id,
                    slot,
                    ...(trigger.probeKey === null ? {} : { probeKey: trigger.probeKey }),
                },
                actorMemberId: null,
            })
            await this.triggers.recordFire(tx, trigger.id, new Date(Number(slot)), next)
        })
        return true
    }
}
