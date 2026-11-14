import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTriggersService } from "@modules/domain/agent-work"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectQueueSchedules, type QueueSchedules } from "@modules/platform/queue"
import {
    AGENT_SCHEDULE_FIRE_QUEUE,
    agentTriggerSchedulerId,
    isAgentScheduleFirePayload,
} from "@modules/queues/agent-turn"
import { AgentSchedulesError, AgentSchedulesErrorCode } from "./errors/agent-schedules.error"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { ClockTickDeliveryService } from "./clock-tick-delivery.service"

@Injectable()
/**
 * What one slot of a trigger does: it is delivered through the one event pipeline (the clock's declared trigger, once-key
 * `<triggerId>:<slot>`), so the dedupe holds even when the sweep and Redis both name the same slot. A trigger that is gone or off removes its own scheduler, and one whose work is
 * switched off is made to agree with that, so a quiet agent keeps nothing in Redis.
 */
export class AgentScheduleFireService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueSchedules() private readonly schedules: QueueSchedules,
        @InjectLogger() private readonly logger: Logger,
        private readonly triggers: AgentTriggersService,
        private readonly clockTicks: ClockTickDeliveryService,
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
            await this.clockTicks.deliverSlot(tx, payload.workspaceId, trigger, slot, null)
            await this.triggers.recordFire(tx, trigger.id, new Date(Number(slot)), next)
        })
        return true
    }

    /**
     * A person runs the next slot of a clock trigger now ("run now"): the SAME wake that slot writes when it comes (keyed
     * `<triggerId>:<slot>`), written now under the person, so when the slot comes its fire finds the wake already written and adds
     * nothing. The scheduler and the row are left as they are. `already_ran`: the wake of that slot was already written (the slot came,
     * or someone pressed first); `not_scheduled`: the trigger is gone, off, not a clock, its work is switched off or its next slot moved.
     */
    async fireNow(workspaceId: string, triggerId: string, slot: Date, memberId: string): Promise<SlotRunNow> {
        const trigger = await this.triggers.byId(triggerId)
        if (trigger === null || !trigger.enabled || trigger.kind !== "schedule") return "not_scheduled"
        if (trigger.nextRunAt?.getTime() !== slot.getTime()) return "not_scheduled"
        if (!(await this.sync.workIsOn(workspaceId, trigger.agentId))) return "not_scheduled"
        const key = String(slot.getTime())
        const delivered = await this.entityManager.transaction((tx) => this.clockTicks.deliverSlot(tx, workspaceId, trigger, key, memberId))
        if (delivered === "untaken") return "not_scheduled"
        return delivered
    }
}

/** What "run now" on a clock slot did. */
export type SlotRunNow = "woken" | "already_ran" | "not_scheduled"
