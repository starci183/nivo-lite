import { Injectable, Optional } from "@nestjs/common"
import { ThreadSweepService } from "@modules/domain/agent-threads"
import type { EntityManager } from "typeorm"
import {
    AgentTasksService,
    AgentTriggersService,
    AgentTurnsService,
    AgentWakeRetentionService,
    AgentWakeService,
    timerTaskOf,
    timerWakeAtOf,
    type AgentWorkDue,
    type TimerTask,
} from "@modules/domain/agent-work"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectAgentTurnQueue, type AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { RETENTION_BATCH, SWEEP_LIMIT, isMissed, latestMissedSlot } from "./agent-schedules.policy"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { ClockTickDeliveryService } from "./clock-tick-delivery.service"
import type { SweepReport, TimerPress } from "./agent-schedules.contracts"

/** What a failed part of the pass is logged with: the kind of part, and for a due item its agent and subject. */
interface SweepPartContext {
    /** A due item's kind (`lease`, `wake`, `task`, `trigger`), or `threads`, or `retention`. */
    readonly kind: string
    /** The agent of a due item. */
    readonly agentId?: string
    /** The subject of a due item, or null. */
    readonly subjectId?: string | null
}

/** What a failed due item is logged with. */
const itemContextOf = (item: AgentWorkDue): SweepPartContext => ({
    kind: item.kind,
    agentId: item.agentId,
    subjectId: item.subjectId,
})

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
        private readonly clockTicks: ClockTickDeliveryService,
        @Optional() private readonly threadSweep?: ThreadSweepService,
    ) {}

    /** Runs one pass and answers what it did. */
    async sweep(): Promise<SweepReport> {
        const due = await this.turns.due(SWEEP_LIMIT)
        const done: Array<Done> = []
        await eachInOrder(due, async (item) => {
            done.push(await this.guarded(() => this.handle(item), null, itemContextOf(item)))
        })
        await this.guarded(
            async () => {
                await this.threadSweep?.sweep()
            },
            undefined,
            { kind: "threads" },
        )
        // A retention that fails is logged like any item: the drains, tasks and triggers above stand, and the next minute retries it.
        const removed = await this.guarded(() => this.retention.sweep(RETENTION_BATCH), 0, { kind: "retention" })
        const report: SweepReport = {
            drains: done.filter((kind) => kind === "drains").length,
            tasks: done.filter((kind) => kind === "tasks").length,
            triggers: done.filter((kind) => kind === "triggers" || kind === "missed").length,
            missed: done.filter((kind) => kind === "missed").length,
            removed,
        }
        this.logger.info(AgentSchedulesLogEvent.SweepDone, { ...report })
        return report
    }

    /**
     * A person runs a task's timer now ("run now"): the SAME wake this sweep writes when the timer comes, keyed by the task and its wake
     * time, written now, with the time cleared in the same transaction, so the timer never fires it a second time. A generic timer is told its
     * moment has come (`dueAt` = now) and who pressed (`runNowBy` in its context); any other task wakes as the internal wake it is, under
     * the person. `already_ran`: the task has no wake time left (it fired, was moved on, closed) or its wake was already written.
     */
    async runTaskNow(item: AgentWorkDue, press: TimerPress): Promise<TaskRunNow> {
        const task = item.subjectId === null ? null : await this.tasks.byId(item.subjectId)
        if (task?.status !== "open" || task.nextActionAt === null || item.at === null)
            return "already_ran"
        if (task.nextActionAt.getTime() !== item.at.getTime()) return "already_ran"
        const timer = timerTaskOf(task.dedupeKey, task.title, task.data)
        const woken =
            timer === null
                ? await this.wakeTask(item, task.id, item.at, press.memberId)
                : await this.timerWake(item, task.id, item.at, timer, press)
        return woken ? "woken" : "already_ran"
    }

    /**
     * Runs one part of the pass so that its failure never fails the pass: a due item, the thread runs' sweep (deadlines, repairs, timers
     * on LangGraph threads ride the same minute) and the retention each answer `failed` and log `SweepItemFailed` with what they were;
     * the rest of the pass goes on and the next minute retries the part.
     */
    private async guarded<T>(work: () => Promise<T>, failed: T, context: SweepPartContext): Promise<T> {
        try {
            return await work()
        } catch (cause) {
            this.logger.error(AgentSchedulesLogEvent.SweepItemFailed, cause, { ...context })
            return failed
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
        const timer = task === null ? null : timerTaskOf(task.dedupeKey, task.title, task.data)
        if (timer !== null) {
            await this.timerWake(item, subjectId, at, timer, null)
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
     * Wakes the agent for a generic timer that fell due: a tag from the system that is the `timer.due` verb, naming the `ref`, the data and
     * the moment (`timerTagOf`), keyed by the task and the due instant so a retried sweep fires once; the task is closed in the same
     * transaction. A task wakes at most seven days ahead, so a timer whose real due instant is still ahead is only moved forward (no wake,
     * false). A person's "run now" fires at once. False when the wake of that time was already written or the timer is not due yet.
     */
    private async timerWake(
        item: AgentWorkDue,
        taskId: string,
        at: Date,
        timer: TimerTask,
        press: TimerPress | null,
    ): Promise<boolean> {
        const now = this.clock.now()
        const due = new Date(timer.dueAt)
        if (press === null && due.getTime() > now.getTime()) {
            await this.tasks.moveWake(taskId, at, timerWakeAtOf(due, now))
            return false
        }
        const tagged = await this.entityManager.transaction(async (tx) => {
            const delivered = await this.clockTicks.deliverTimer(tx, item, taskId, timer, press)
            await this.tasks.markFired(tx, taskId, at)
            return delivered === "woken"
        })
        this.logger.info(AgentSchedulesLogEvent.TimerWoken, { agentId: item.agentId, early: press !== null })
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
            await this.clockTicks.deliverSlot(tx, item.workspaceId, trigger, String(slot.getTime()), null)
            await this.triggers.recordFire(tx, trigger.id, slot, next)
        })
        return "missed"
    }
}
