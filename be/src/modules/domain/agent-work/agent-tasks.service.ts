import { Injectable } from "@nestjs/common"
import { In, IsNull, Not, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { toTaskRecord } from "./agent-work.mapper"
import { boundedWakeAt } from "./agent-work.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTaskEntity } from "./persistence/entities"
import type { AgentTaskData, AgentTaskOp, AgentTaskRecord } from "./agent-work.contracts"

/** The most tasks a list shows. */
const TASKS_MAX = 100

/** The longest title a task keeps. */
const TITLE_MAX = 200

/** A generic timer as `armTimer` takes it: its task key, its title, the wake time and the data it carries back. */
export interface TimerArm {
    /** The task key of the timer. */
    readonly key: string
    /** The task title, which carries the real due instant. */
    readonly title: string
    /** When the task wakes the sweep. */
    readonly wakeAt: Date
    /** What the timer carries back; null clears what an earlier arm kept. */
    readonly data: AgentTaskData | null
}

@Injectable()
/**
 * The agent's own to-do. The agent asks for changes through its proposal, one operation per task key: the key is the dedupe key, so the
 * same proposal applied twice (a retried settle) changes nothing the second time. The only writer of agent_tasks.
 */
export class AgentTasksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
    ) {}

    /** The tasks still alive (open and waiting), the next to wake first. */
    async alive(agentId: string): Promise<ReadonlyArray<AgentTaskRecord>> {
        const rows = await this.entityManager.find(AgentTaskEntity, {
            where: { agentId, status: In(["open", "waiting"]) },
            order: { nextActionAt: { direction: "ASC", nulls: "LAST" }, createdAt: "ASC" },
            take: TASKS_MAX,
        })
        return rows.map((item) => toTaskRecord(item))
    }

    /** One task by its id, or null when there is none. */
    async byId(taskId: string): Promise<AgentTaskRecord | null> {
        const row = await this.entityManager.findOne(AgentTaskEntity, { where: { id: taskId } })
        return row === null ? null : toTaskRecord(row)
    }

    /** Applies the operations of a proposal in order. A wake time the agent asks for is kept between five minutes and seven days ahead. */
    async apply(workspaceId: string, agentId: string, ops: ReadonlyArray<AgentTaskOp>): Promise<void> {
        await eachInOrder(ops, (op) => this.applyOne(workspaceId, agentId, op))
    }

    /**
     * Clears the wake time of a task once the wake it asked for was written, in the transaction that wrote it, so the sweep does not find it
     * due again; a task the agent moved to another time meanwhile is left alone.
     */
    async markWoken(tx: EntityManager, taskId: string, at: Date): Promise<void> {
        await tx.update(AgentTaskEntity, { id: taskId, nextActionAt: at }, { nextActionAt: null })
    }

    /**
     * Arms the task of a generic timer (`timer-task.policy.ts`): its key, a title that carries the real due instant, the wake time the
     * caller computed (NOT bounded here: a timer may be due in a minute, and the sweep moves a farther one forward), and the data it
     * carries back (null clears what an earlier arm kept). Arming a key again moves the same task and reopens it.
     */
    async armTimer(workspaceId: string, agentId: string, timer: TimerArm): Promise<void> {
        await this.entityManager.upsert(
            AgentTaskEntity,
            {
                workspaceId,
                agentId,
                dedupeKey: timer.key,
                title: timer.title.slice(0, TITLE_MAX),
                status: "open",
                waitingOn: null,
                nextActionAt: timer.wakeAt,
                doneAt: null,
                data: timer.data,
            },
            ["agentId", "dedupeKey"],
        )
    }

    /** Cancels an armed timer of the agent by its key: true when one was armed (open and waiting for its time), false when none was. */
    async cancelTimer(agentId: string, key: string): Promise<boolean> {
        const cancelled = await this.entityManager.update(
            AgentTaskEntity,
            { agentId, dedupeKey: key, status: "open", nextActionAt: Not(IsNull()) },
            { status: "done", doneAt: this.clock.now(), nextActionAt: null },
        )
        return (cancelled.affected ?? 0) > 0
    }

    /** Moves the wake time of a task forward, only when it is still the time it was read at (a timer farther than seven days away). */
    async moveWake(taskId: string, from: Date, to: Date): Promise<void> {
        await this.entityManager.update(AgentTaskEntity, { id: taskId, nextActionAt: from }, { nextActionAt: to })
    }

    /**
     * Closes the task of a timer once the wake it asked for was written, in the transaction that wrote it: its time is cleared and it is
     * done (arming the key again reopens it). A task moved to another time meanwhile is left alone.
     */
    async markFired(tx: EntityManager, taskId: string, at: Date): Promise<void> {
        await tx.update(
            AgentTaskEntity,
            { id: taskId, nextActionAt: at },
            { nextActionAt: null, status: "done", doneAt: this.clock.now() },
        )
    }

    /** Drops a task. Owner or manager; the task must be the agent's. */
    async drop(userId: string, workspaceId: string, agentId: string, taskId: string): Promise<void> {
        await this.access.manager(userId, workspaceId)
        const dropped = await this.entityManager.update(
            AgentTaskEntity,
            { id: taskId, agentId, workspaceId, status: In(["open", "waiting"]) },
            { status: "dropped", doneAt: this.clock.now(), nextActionAt: null, waitingOn: null },
        )
        if (dropped.affected === 0) throw new AgentWorkError({ code: AgentWorkErrorCode.TaskNotFound })
    }

    private async applyOne(workspaceId: string, agentId: string, op: AgentTaskOp): Promise<void> {
        const now = this.clock.now()
        const wakeAt = op.nextActionAt === undefined ? null : boundedWakeAt(op.nextActionAt, now)
        if (op.op === "done") {
            await this.entityManager.update(
                AgentTaskEntity,
                { agentId, dedupeKey: op.key, status: In(["open", "waiting"]) },
                { status: "done", doneAt: now, nextActionAt: null, waitingOn: null },
            )
            return
        }
        const parked = op.op === "wait" && wakeAt === null
        await this.entityManager.upsert(
            AgentTaskEntity,
            {
                workspaceId,
                agentId,
                dedupeKey: op.key,
                title: (op.title ?? op.key).slice(0, TITLE_MAX),
                status: parked ? "waiting" : "open",
                waitingOn: parked ? (op.waitingOn ?? "event") : null,
                nextActionAt: wakeAt,
                goalId: op.goalId ?? null,
                originWakeId: op.originWakeId ?? null,
                workItemId: op.workItemId ?? null,
                doneAt: null,
                ...(op.data === undefined ? {} : { data: op.data }),
            },
            ["agentId", "dedupeKey"],
        )
    }
}
