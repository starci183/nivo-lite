import { Injectable } from "@nestjs/common"
import { AgentTriggersService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectQueueSchedules } from "@modules/platform/queue"
import type { QueueSchedules } from "@modules/platform/queue"
import { AGENT_SCHEDULE_FIRE_JOB, AGENT_SCHEDULE_FIRE_QUEUE, agentTriggerSchedulerId } from "@modules/queues/agent-turn"
import type { AgentScheduleTemplatePayload } from "@modules/queues/agent-turn"
import { scheduleOf } from "./agent-schedules.policy"
import type { NextSlot, TriggerSeed } from "./agent-schedules.contracts"

@Injectable()
/**
 * Keeps the schedulers in Redis true to the trigger rows (BE-QUEUES-3): the row is the truth, the scheduler its projection. A trigger that
 * is off, an event, or belongs to an agent or a workspace whose work is switched off has no scheduler; every other clock trigger has
 * one keyed by its id, on the agent's spread minute.
 */
export class AgentTriggerSyncService {
    constructor(
        @InjectQueueSchedules() private readonly schedules: QueueSchedules,
        @InjectClock() private readonly clock: Clock,
        private readonly triggers: AgentTriggersService,
        private readonly settings: AgentWorkSettingsService,
    ) {}

    /**
     * Makes the scheduler of the trigger agree with its row and records that it does. Answers the next slot the scheduler holds, or null
     * when the trigger has none (off, an event, or its agent's work is switched off).
     */
    async reconcile(workspaceId: string, trigger: AgentTriggerRecord): Promise<NextSlot> {
        const when = (await this.workIsOn(workspaceId, trigger.agentId)) ? scheduleOf(trigger, trigger.agentId) : null
        if (!trigger.enabled || when === null) {
            await this.unschedule(trigger.id)
            await this.triggers.recordReconciled(trigger.id, this.clock.now(), null)
            return null
        }
        const payload: AgentScheduleTemplatePayload = { workspaceId, agentId: trigger.agentId, triggerId: trigger.id }
        const next = await this.schedules.schedule(
            AGENT_SCHEDULE_FIRE_QUEUE,
            agentTriggerSchedulerId(trigger.id),
            when,
            AGENT_SCHEDULE_FIRE_JOB,
            payload,
        )
        await this.triggers.recordReconciled(trigger.id, this.clock.now(), next)
        return next
    }

    /** Removes the scheduler of a trigger; harmless when it has none. */
    unschedule(triggerId: string): Promise<void> {
        return this.schedules.unschedule(AGENT_SCHEDULE_FIRE_QUEUE, agentTriggerSchedulerId(triggerId))
    }

    /** True while neither the agent nor its workspace has work switched off. */
    async workIsOn(workspaceId: string, agentId: string): Promise<boolean> {
        const [workspace, agent] = await Promise.all([this.settings.settingsOf(workspaceId), this.settings.stateOf(agentId)])
        return workspace.workEnabled && agent.workEnabled
    }

    /**
     * Seeds the clock triggers a module declares for its agent, one row per key. Only rows are written: the minute sweep finds them
     * unreconciled and makes the schedulers, so an install never waits on Redis, and a repeated install or apply finds its rows.
     */
    async seed(workspaceId: string, agentId: string, seeds: ReadonlyArray<TriggerSeed>): Promise<void> {
        await eachInOrder(seeds, async (seed) => {
            await this.triggers.seed(
                {
                    workspaceId,
                    agentId,
                    triggerId: null,
                    kind: "schedule",
                    preset: seed.preset,
                    atTime: seed.atTime ?? null,
                    timeZone: null,
                    eventName: null,
                    probeKey: seed.probeKey ?? null,
                    enabled: true,
                },
                seed.key,
            )
        })
    }
}
