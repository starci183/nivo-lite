import { Injectable, Optional } from "@nestjs/common"
import { ThreadSweepService } from "@modules/domain/agent-threads"
import { AgentRunSweepService } from "@modules/domain/agent-runs"
import type { EntityManager } from "typeorm"
import {
    AgentTagService,
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
import { careTaskOf } from "@nivo-lite/blocks-core"
import type { CareTask } from "@nivo-lite/blocks-core"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { RETENTION_BATCH, SWEEP_LIMIT, careTagOf, isMissed, latestMissedSlot } from "./agent-schedules.policy"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import type { SweepReport, TimerPress } from "./agent-schedules.contracts"

/** What handling one due item did, for the report. */
type Done = keyof Omit<SweepReport, "removed"> | null

/** What "run now" on a task's timer did: the wake of its time was written now (`woken`), or it already was (`already_ran`). */
export type TaskRunNow = "woken" | "already_ran"

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
        private readonly runSweep: AgentRunSweepService,
        private readonly tags: AgentTagService,
        @Optional() private readonly threadSweep?: ThreadSweepService,
    ) {}

    /** Runs one pass and answers what it did. */
    async sweep(): Promise<SweepReport> {
        const due = await this.turns.due(SWEEP_LIMIT)
        const done: Array<Done> = []
        await eachInOrder(due, async (item) => {
            done.push(await this.guarded(item))
        })
        await this.sweepRuns()
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

    /**
     * A person runs a task's timer now ("run now"): the SAME wake this sweep writes when the timer comes, keyed by the task and its wake
     * time, written now, with the time cleared in the same transaction, so the timer never fires it a second time. A care step is told its
     * moment has come (`dueAt` = now) and who pressed (`runNowBy` in its context); any other task wakes as the internal wake it is, under
     * the person. `already_ran`: the task has no wake time left (it fired, was moved on, closed) or its wake was already written.
     */
    async runTaskNow(item: AgentWorkDue, press: TimerPress): Promise<TaskRunNow> {
        const task = item.subjectId === null ? null : await this.tasks.byId(item.subjectId)
        if (task === null || task.status !== "open" || task.nextActionAt === null || item.at === null) return "already_ran"
        if (task.nextActionAt.getTime() !== item.at.getTime()) return "already_ran"
        const care = careTaskOf(task.dedupeKey, task.title)
        const woken =
            care === null
                ? await this.wakeTask(item, task.id, item.at, press.memberId)
                : await this.careWake(item, task.id, item.at, care, press)
        return woken ? "woken" : "already_ran"
    }

    /** The durable runs ride the same minute: their steps past a deadline are resumed, retried or stopped visibly. One failing pass never stops the rest. */
    private async sweepRuns(): Promise<void> {
        try {
            await this.runSweep.sweep()
        } catch (cause) {
            this.logger.error(AgentSchedulesLogEvent.SweepItemFailed, cause, { kind: "runs" })
        }
        // The runs on LangGraph threads ride the same minute; that sweep reads nothing while no workflow is on threads.
        try {
            await this.threadSweep?.sweep()
        } catch (cause) {
            this.logger.error(AgentSchedulesLogEvent.SweepItemFailed, cause, { kind: "threads" })
        }
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
        const task = await this.tasks.byId(subjectId)
        const care = task === null ? null : careTaskOf(task.dedupeKey, task.title)
        if (care !== null) {
            await this.careWake(item, subjectId, at, care, null)
            return "tasks"
        }
        await this.wakeTask(item, subjectId, at, null)
        return "tasks"
    }

    /** Writes the internal wake of a task's time (false when it was already written) and clears that time, in one transaction. */
    private wakeTask(item: AgentWorkDue, taskId: string, at: Date, memberId: string | null): Promise<boolean> {
        return this.entityManager.transaction(async (tx) => {
            const written = await this.wakes.wake(tx, {
                workspaceId: item.workspaceId,
                agentId: item.agentId,
                source: "internal",
                eventKey: `task:${taskId}:${String(at.getTime())}`,
                context: { taskId, subjectId: taskId },
                actorMemberId: memberId,
            })
            await this.tasks.markWoken(tx, taskId, at)
            return written
        })
    }

    /**
     * Wakes the Sales agent for a care step that fell due: a tag from the system whose context names the step, the record it is about and the
     * moment it was really due (a task wakes at most seven days ahead, so the graph arms it again when it is early), keyed by the task and the
     * moment so a replay is one wake. The task's wake time is cleared in the same transaction. A person's "run now" makes the moment now and
     * names them. False when the wake of that time was already written.
     */
    private async careWake(item: AgentWorkDue, taskId: string, at: Date, care: CareTask, press: TimerPress | null): Promise<boolean> {
        const tagged = await this.entityManager.transaction(async (tx) => {
            const result = await this.tags.tagAgent(careTagOf(item, taskId, at, care, press), tx)
            await this.tasks.markWoken(tx, taskId, at)
            return result.tagged
        })
        this.logger.info(AgentSchedulesLogEvent.CareWoken, { agentId: item.agentId, kind: care.kind, early: press !== null })
        return tagged
    }

    /** Makes the scheduler of an unreconciled or late trigger agree with its row; a slot that was missed gets one wake, the latest only. */
    private async repairTrigger(item: AgentWorkDue): Promise<Done> {
        const trigger = item.subjectId === null ? null : await this.triggers.byId(item.subjectId)
        if (trigger === null) return null
        const next = await this.sync.reconcile(item.workspaceId, trigger)
        const now = this.clock.now()
        if (next === null || trigger.preset === null || item.at === null || !isMissed(item.at, now)) return "triggers"
        const slot = latestMissedSlot(item.at, next, { ...trigger, preset: trigger.preset }, item.agentId)
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
