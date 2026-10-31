import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AgentTasksService,
    AgentTriggersService,
    AgentTurnsService,
    AgentWakeRetentionService,
    AgentWakeService,
} from "@modules/domain/agent-work"
import type { AgentWorkDue } from "@modules/domain/agent-work"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { RETENTION_BATCH, SWEEP_LIMIT, isMissed, latestMissedSlot } from "./agent-schedules.policy"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import type { SweepReport } from "./agent-schedules.contracts"

/** What handling one due item did, for the report. */
type Done = keyof Omit<SweepReport, "removed"> | null

@Injectable()
/**
 * The backstop under the road, run once a minute (BE-QUEUES-3). Redis is a projection and a job is a hint, so this walks what the database
 * says is due and repairs it: a drain for a scope whose lease lapsed or whose wake nobody picked up, a wake for a task that fell due, the
 * scheduler of a trigger that is unreconciled or late (with one wake for the latest slot it missed, never a replay), and the removal of
 * wakes past retention. Every pass is bounded, and one failing item never stops the rest.
 */
export class AgentWorkSweepService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectAgentTurnQueue() private readonly queue: AgentTurnQueue,
        private readonly turns: AgentTurnsService,
        private readonly wakes: AgentWakeService,
        private readonly tasks: AgentTasksService,
        private readonly triggers: AgentTriggersService,
        private readonly retention: AgentWakeRetentionService,
        private readonly sync: AgentTriggerSyncService,
    ) {}

    /** Runs one pass and answers what it did. */
    async sweep(): Promise<SweepReport> {
        const due = await this.turns.due(SWEEP_LIMIT)
        const done: Array<Done> = []
        await eachInOrder(due, async (item) => {
            done.push(await this.guarded(item))
        })
        const report: SweepReport = {
            drains: done.filter((kind) => kind === "drains").length,
            tasks: done.filter((kind) => kind === "tasks").length,
            triggers: done.filter((kind) => kind === "triggers" || kind === "missed").length,
            missed: done.filter((kind) => kind === "missed").length,
            removed: await this.retention.sweep(RETENTION_BATCH),
        }
        this.logger.info(AgentSchedulesLogEvent.SweepDone, { ...report })
        return report
    }

    private async guarded(item: AgentWorkDue): Promise<Done> {
        try {
            return await this.handle(item)
        } catch (cause) {
            this.logger.error(AgentSchedulesLogEvent.SweepItemFailed, cause, {
                kind: item.kind,
                agentId: item.agentId,
                subjectId: item.subjectId,
            })
            return null
        }
    }

    private handle(item: AgentWorkDue): Promise<Done> {
        if (item.kind === "task") return this.wakeForTask(item)
        if (item.kind === "trigger") return this.repairTrigger(item)
        return this.drain(item)
    }

    /** Starts a drain of a scope whose lease lapsed or whose due wake nobody picked up; one per scope and minute. */
    private async drain(item: AgentWorkDue): Promise<Done> {
        const scope = { workspaceId: item.workspaceId, agentId: item.agentId, scopeKey: item.scopeKey }
        await this.entityManager.transaction((tx) => this.queue.enqueueSweepDrain(scope, this.clock.now(), tx))
        return "drains"
    }

    /** Writes the one internal wake of a task that fell due, keyed by the task and the moment, and clears the time the wake answered. */
    private async wakeForTask(item: AgentWorkDue): Promise<Done> {
        if (item.subjectId === null || item.at === null) return null
        const { subjectId, at } = item
        await this.entityManager.transaction(async (tx) => {
            await this.wakes.wake(tx, {
                workspaceId: item.workspaceId,
                agentId: item.agentId,
                source: "internal",
                eventKey: `task:${subjectId}:${String(at.getTime())}`,
                context: { taskId: subjectId, subjectId },
                actorMemberId: null,
            })
            await this.tasks.markWoken(tx, subjectId, at)
        })
        return "tasks"
    }

    /** Makes the scheduler of an unreconciled or late trigger agree with its row; a slot that was missed gets one wake, the latest only. */
    private async repairTrigger(item: AgentWorkDue): Promise<Done> {
        const trigger = item.subjectId === null ? null : await this.triggers.byId(item.subjectId)
        if (trigger === null) return null
        const next = await this.sync.reconcile(item.workspaceId, trigger)
        const now = this.clock.now()
        if (next === null || trigger.preset === null || item.at === null || !isMissed(item.at, now)) return "triggers"
        const slot = latestMissedSlot(item.at, next, trigger.preset)
        await this.entityManager.transaction(async (tx) => {
            await this.wakes.wake(tx, {
                workspaceId: item.workspaceId,
                agentId: item.agentId,
                source: "schedule",
                eventKey: `${trigger.id}:${String(slot.getTime())}`,
                context: {
                    triggerId: trigger.id,
                    slot: String(slot.getTime()),
                    ...(trigger.probeKey === null ? {} : { probeKey: trigger.probeKey }),
                },
                actorMemberId: null,
            })
            await this.triggers.recordFire(tx, trigger.id, slot, next)
        })
        return "missed"
    }
}
