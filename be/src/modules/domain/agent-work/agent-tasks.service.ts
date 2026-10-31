import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { toTaskRecord } from "./agent-work.mapper"
import { boundedWakeAt } from "./agent-work.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTaskEntity } from "./persistence/entities"
import type { AgentTaskOp, AgentTaskRecord } from "./agent-work.contracts"

/** The most tasks a list shows. */
const TASKS_MAX = 100

/** The longest title a task keeps. */
const TITLE_MAX = 200

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
        return rows.map(toTaskRecord)
    }

    /** Applies the operations of a proposal in order. A wake time the agent asks for is kept between five minutes and seven days ahead. */
    async apply(workspaceId: string, agentId: string, ops: ReadonlyArray<AgentTaskOp>): Promise<void> {
        await eachInOrder(ops, (op) => this.applyOne(workspaceId, agentId, op))
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
            },
            ["agentId", "dedupeKey"],
        )
    }
}
