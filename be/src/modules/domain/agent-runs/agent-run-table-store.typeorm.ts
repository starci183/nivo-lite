import { Injectable } from "@nestjs/common"
import { And, Brackets, In, IsNull, LessThan, MoreThanOrEqual, Not, type FindOperator, type FindOptionsWhere } from "typeorm"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { isRecord } from "@modules/platform/primitives"
import type { AgentRunTableStore } from "./agent-run-table-store.port"
import type {
    RunCount,
    RunCountFilter,
    RunInsert,
    RunListFilter,
    RunPinValues,
    RunValues,
    RunWaiterFilter,
    RunWaitMark,
    RunWindow,
    RunWorkItem,
    StepCounts,
    StepInsert,
    StepValues,
    StoredRun,
    StoredStep,
    StoredWaiter,
} from "./agent-runs-rows.contracts"
import type { StepJson } from "./agent-runs.contracts"
import { AgentRunEntity, AgentRunStepEntity } from "./persistence/entities"

/** The step statuses that count as done on the run list. */
const DONE_STEPS: ReadonlySet<string> = new Set(["done", "compensated"])

/** True when an insert wrote its row: Postgres answers the inserted rows, none when the conflict left it out. */
const insertedOf = (raw: unknown): boolean => Array.isArray(raw) && raw.length > 0

const isoOf = (at: Date | null): string | null => (at === null ? null : at.toISOString())

const jsonOf = (value: object | null): StepJson | null => (value === null || !isRecord(value) ? null : value)

const objectOf = (value: object): StepJson => (isRecord(value) ? value : {})

/** A run as the store hands it out. */
export const storedRunOf = (row: AgentRunEntity): StoredRun => ({
    id: row.id,
    workspaceId: row.workspaceId,
    version: String(row.version),
    agentId: row.agentId,
    wakeId: row.wakeId,
    trigger: row.trigger,
    graphVersionId: row.graphVersionId,
    planning: row.planning,
    status: row.status,
    engine: row.engine,
    context: objectOf(row.context),
    error: jsonOf(row.error),
    deadLetteredAt: isoOf(row.deadLetteredAt),
    parkedBuild: row.parkedBuild,
    parkReason: row.parkReason,
    resumeAttempts: row.resumeAttempts,
    resumeNotBefore: isoOf(row.resumeNotBefore),
    resumedAt: isoOf(row.resumedAt),
    resumedBy: row.resumedBy,
    resumeReason: row.resumeReason,
    waitWorkItemId: row.waitWorkItemId,
    waitDeadlineAt: isoOf(row.waitDeadlineAt),
    stepSeq: row.stepSeq,
    startedAt: row.startedAt.toISOString(),
    endedAt: isoOf(row.endedAt),
    cancelledAt: isoOf(row.cancelledAt),
    cancelledBy: row.cancelledBy,
    workflowId: row.workflowId,
    workflowVersionId: row.workflowVersionId,
    workflowVersion: row.workflowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

/** A step as the store hands it out. */
export const storedStepOf = (row: AgentRunStepEntity): StoredStep => ({
    id: row.id,
    workspaceId: row.workspaceId,
    version: String(row.version),
    runId: row.runId,
    ordinal: row.ordinal,
    stepKey: row.stepKey,
    nodeKey: row.nodeKey,
    kind: row.kind,
    effect: objectOf(row.effect),
    input: objectOf(row.input),
    result: jsonOf(row.result),
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    deadlineMs: row.deadlineMs,
    notBefore: isoOf(row.notBefore),
    waitItemId: row.waitItemId,
    workItemId: row.workItemId,
    compAttempts: row.compAttempts,
    errorCode: row.errorCode,
    claimedUntil: isoOf(row.claimedUntil),
    startedAt: isoOf(row.startedAt),
    endedAt: isoOf(row.endedAt),
    durationMs: row.durationMs,
    doorCalls: objectOf(row.doorCalls),
    effectKey: row.effectKey,
    error: jsonOf(row.error),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

const instantOf = (value: string | null): Date | null => (value === null ? null : new Date(value))

/** The run members that are instants. */
const RUN_TIMES = [
    "deadLetteredAt",
    "resumeNotBefore",
    "resumedAt",
    "waitDeadlineAt",
    "startedAt",
    "endedAt",
    "cancelledAt",
] as const

/** The step members that are instants. */
const STEP_TIMES = ["notBefore", "claimedUntil", "startedAt", "endedAt"] as const

/** The members of a write as column values: the instants as instants, the JSON copied; an absent member is left out. */
const columnValuesOf = (values: object, times: ReadonlyArray<string>): Readonly<Record<string, unknown>> =>
    Object.fromEntries(
        Object.entries(values)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]): [string, unknown] => {
                if (times.includes(name)) return [name, typeof value === "string" ? instantOf(value) : null]
                return [name, typeof value === "object" && value !== null ? structuredClone(value) : value]
            }),
    )

/** A run row holding only the members a write sets (TypeORM writes the members a row holds; the rest keep their value or default). */
const runColumnsOf = (values: object): AgentRunEntity => Object.assign(new AgentRunEntity(), columnValuesOf(values, RUN_TIMES))

/** A step row holding only the members a write sets. */
const stepColumnsOf = (values: object): AgentRunStepEntity =>
    Object.assign(new AgentRunStepEntity(), columnValuesOf(values, STEP_TIMES))

/** The instants of a window: from its first instant in, before its first instant out. */
const windowOf = (window: RunWindow): FindOperator<Date> =>
    And(MoreThanOrEqual(new Date(window.from)), LessThan(new Date(window.to)))

/** The sort a run listing names: newest started, newest ended, or soonest resume. */
const runOrderOf = (order: RunListFilter["order"]) => {
    if (order === "started") return { startedAt: "DESC", id: "DESC" } as const
    if (order === "ended") return { endedAt: "DESC", id: "DESC" } as const
    return { resumeNotBefore: "ASC", id: "ASC" } as const
}

@Injectable()
/**
 * The runs and steps on their two core tables, in the caller's transaction (`ScopedTx.manager`). No raw SQL statement: the one clause
 * written as text is `waiters`' array overlap and `strpos` over `wait_match`, which TypeORM's find operators do not express.
 */
export class TypeormAgentRunTableStore implements AgentRunTableStore {
    /** One run of the workspace by id, or null. */
    async run(tx: ScopedTx, id: string): Promise<StoredRun | null> {
        const row = await tx.manager.findOne(AgentRunEntity, { where: { workspaceId: tx.workspaceId, id } })
        return row === null ? null : storedRunOf(row)
    }

    /** The first run of a wake (lowest id), or null. */
    async runOfWake(tx: ScopedTx, wakeId: string): Promise<StoredRun | null> {
        const row = await tx.manager.findOne(AgentRunEntity, {
            where: { workspaceId: tx.workspaceId, wakeId },
            order: { id: "ASC" },
        })
        return row === null ? null : storedRunOf(row)
    }

    /** The runs matching a filter in the order it names (newest started, newest ended, or soonest resume), at most the limit, after its skip. */
    async runs(tx: ScopedTx, filter: RunListFilter, limit: number): Promise<ReadonlyArray<StoredRun>> {
        if (filter.ids?.length === 0 || filter.statuses?.length === 0) return []
        const where: FindOptionsWhere<AgentRunEntity> = {
            workspaceId: tx.workspaceId,
            ...(filter.agentId === undefined ? {} : { agentId: filter.agentId }),
            ...(filter.ids === undefined ? {} : { id: In([...filter.ids]) }),
            ...(filter.statuses === undefined ? {} : { status: In([...filter.statuses]) }),
            ...(filter.engine === undefined ? {} : { engine: filter.engine }),
            ...(filter.workflowId === undefined ? {} : { workflowId: filter.workflowId }),
            ...(filter.subject === undefined ? {} : { subjectKind: filter.subject.kind, subjectId: filter.subject.id }),
            ...(filter.waitMarked === true ? { waitMatch: Not(IsNull()) } : {}),
        }
        const order = runOrderOf(filter.order)
        const rows = await tx.manager.find(AgentRunEntity, { where, order, take: limit, skip: filter.skip ?? 0 })
        return rows.map((item) => storedRunOf(item))
    }

    /** The run counts matching a filter, grouped as the filter asks. */
    async counts(tx: ScopedTx, filter: RunCountFilter): Promise<ReadonlyArray<RunCount>> {
        if (filter.statuses?.length === 0) return []
        const where: FindOptionsWhere<AgentRunEntity> = {
            workspaceId: tx.workspaceId,
            ...(filter.agentId === undefined ? {} : { agentId: filter.agentId }),
            ...(filter.statuses === undefined ? {} : { status: In([...filter.statuses]) }),
            ...(filter.started === undefined ? {} : { startedAt: windowOf(filter.started) }),
            ...(filter.ended === undefined ? {} : { endedAt: windowOf(filter.ended) }),
        }
        const groups: ReadonlyArray<{ readonly agentId: string; readonly status: string; readonly count: string }> =
            await tx.manager
                .createQueryBuilder(AgentRunEntity, "run")
                .select("run.agentId", "agentId")
                .addSelect("run.status", "status")
                .addSelect("COUNT(*)", "count")
                .where(where)
                .groupBy("run.agentId")
                .addGroupBy("run.status")
                .getRawMany()
        return groups.map((group) => ({ agentId: group.agentId, status: group.status, count: Number(group.count) }))
    }

    /** Insert a run, ignoring a conflict; the run of its wake, or null when the insert did not land. */
    async insertRun(tx: ScopedTx, run: RunInsert): Promise<StoredRun | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .insert()
            .into(AgentRunEntity)
            .values(Object.assign(runColumnsOf(run), { workspaceId: tx.workspaceId }))
            .orIgnore()
            .returning(["id"])
            .execute()
        if (!insertedOf(result.raw)) return null
        return this.runOfWake(tx, run.wakeId)
    }

    /** Patch a run under its version fence; null when the fence no longer holds. */
    async patchRun(tx: ScopedTx, id: string, fence: string, values: RunValues): Promise<StoredRun | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .update(AgentRunEntity)
            .set({ ...runColumnsOf(values), version: () => "version + 1" })
            .where({ workspaceId: tx.workspaceId, id, version: Number(fence) })
            .execute()
        return (result.affected ?? 0) > 0 ? this.run(tx, id) : null
    }

    /** Mark (or clear) the wait a run is parked on; the fence is left as it is (the mark is the run's own lookup index). */
    async markWait(tx: ScopedTx, id: string, mark: RunWaitMark | null): Promise<void> {
        await tx.manager
            .createQueryBuilder()
            .update(AgentRunEntity)
            .set(
                mark === null || mark.match.length === 0
                    ? { waitMatch: null, waitSince: null }
                    : { waitMatch: [...mark.match], waitSince: new Date(mark.since) },
            )
            .where({ workspaceId: tx.workspaceId, id })
            .execute()
    }

    /**
     * The runs of the agents (in the statuses and on the engine named) whose wait keys the event's probe names: one key of `exact` (the
     * GIN index's overlap), or one `contains` marker AND one of its parts found in the event's text of that prefix (`strpos`, exact
     * substring). Every such run, no page: an event never misses its waiter because the agent has many open runs.
     */
    async waiters(tx: ScopedTx, filter: RunWaiterFilter): Promise<ReadonlyArray<StoredWaiter>> {
        if (filter.agentIds.length === 0 || filter.statuses.length === 0 || (filter.exact.length === 0 && filter.markers.length === 0)) return []
        const rows = await tx.manager
            .createQueryBuilder(AgentRunEntity, "run")
            .select(["run.id", "run.agentId", "run.context", "run.waitSince"])
            .where({ workspaceId: tx.workspaceId, agentId: In([...filter.agentIds]), status: In([...filter.statuses]), engine: filter.engine })
            .andWhere("run.wait_match IS NOT NULL")
            .andWhere(
                new Brackets((either) => {
                    either.where("run.wait_match && CAST(:exact AS text[])", { exact: [...filter.exact] })
                    if (filter.markers.length === 0) return
                    either.orWhere(
                        new Brackets((contains) => {
                            contains.where("run.wait_match && CAST(:markers AS text[])", { markers: [...filter.markers] }).andWhere(
                                `EXISTS (SELECT 1 FROM unnest(run.wait_match) AS entry(key), jsonb_each_text(CAST(:texts AS jsonb)) AS probe(prefix, body)
                                    WHERE left(entry.key, length(probe.prefix)) = probe.prefix
                                    AND strpos(probe.body, substr(entry.key, length(probe.prefix) + 1)) > 0)`,
                                { texts: JSON.stringify(filter.texts) },
                            )
                        }),
                    )
                }),
            )
            .getMany()
        return rows.map((row) => ({ id: row.id, agentId: row.agentId, context: objectOf(row.context), waitSince: isoOf(row.waitSince) }))
    }

    /** Pin the values given on a run that holds no workflow yet; whether a row was pinned. */
    async pinRun(tx: ScopedTx, id: string, pin: RunPinValues): Promise<boolean> {
        const result = await tx.manager
            .createQueryBuilder()
            .update(AgentRunEntity)
            .set({ ...pin, version: () => "version + 1" })
            .where({ workspaceId: tx.workspaceId, id, workflowId: IsNull() })
            .execute()
        return (result.affected ?? 0) > 0
    }

    /** The steps of a run, at most the limit. */
    async steps(tx: ScopedTx, runId: string, limit: number): Promise<ReadonlyArray<StoredStep>> {
        const rows = await tx.manager.find(AgentRunStepEntity, {
            where: { workspaceId: tx.workspaceId, runId },
            order: { ordinal: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((item) => storedStepOf(item))
    }

    /** Insert a step, ignoring a conflict; the step of its run and key, or null when the insert did not land. */
    async insertStep(tx: ScopedTx, step: StepInsert): Promise<StoredStep | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .insert()
            .into(AgentRunStepEntity)
            .values(Object.assign(stepColumnsOf(step), { workspaceId: tx.workspaceId }))
            .orIgnore()
            .returning(["id"])
            .execute()
        if (!insertedOf(result.raw)) return null
        const row = await tx.manager.findOne(AgentRunStepEntity, {
            where: { workspaceId: tx.workspaceId, runId: step.runId, stepKey: step.stepKey },
        })
        return row === null ? null : storedStepOf(row)
    }

    /** Patch a step under its version fence; null when the fence no longer holds. */
    async patchStep(tx: ScopedTx, id: string, fence: string, values: StepValues): Promise<StoredStep | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .update(AgentRunStepEntity)
            .set({ ...stepColumnsOf(values), version: () => "version + 1" })
            .where({ workspaceId: tx.workspaceId, id, version: Number(fence) })
            .execute()
        if ((result.affected ?? 0) === 0) return null
        const row = await tx.manager.findOne(AgentRunStepEntity, { where: { workspaceId: tx.workspaceId, id } })
        return row === null ? null : storedStepOf(row)
    }

    /** The step counts of the runs given. */
    async stepCounts(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<StepCounts>> {
        if (runIds.length === 0) return []
        const groups: ReadonlyArray<{ readonly runId: string; readonly status: string; readonly count: string }> =
            await tx.manager
                .createQueryBuilder(AgentRunStepEntity, "step")
                .select("step.runId", "runId")
                .addSelect("step.status", "status")
                .addSelect("COUNT(*)", "count")
                .where({ workspaceId: tx.workspaceId, runId: In([...runIds]) })
                .groupBy("step.runId")
                .addGroupBy("step.status")
                .getRawMany()
        const byRun = new Map<string, { total: number; done: number; begun: number; failed: number }>()
        for (const group of groups) {
            const count = Number(group.count)
            const held = byRun.get(group.runId) ?? { total: 0, done: 0, begun: 0, failed: 0 }
            byRun.set(group.runId, {
                total: held.total + count,
                done: held.done + (DONE_STEPS.has(group.status) ? count : 0),
                begun: held.begun + (group.status === "pending" ? 0 : count),
                failed: held.failed + (group.status === "failed" ? count : 0),
            })
        }
        return [...byRun].map(([runId, counts]) => ({ runId, ...counts }))
    }

    /** The distinct work items the steps of the runs given point at, in run and step order. */
    async workItemsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunWorkItem>> {
        if (runIds.length === 0) return []
        const rows = await tx.manager.find(AgentRunStepEntity, {
            select: { runId: true, workItemId: true, ordinal: true, id: true },
            where: { workspaceId: tx.workspaceId, runId: In([...runIds]), workItemId: Not(IsNull()) },
            order: { runId: "ASC", ordinal: "ASC", id: "ASC" },
        })
        const seen = new Set<string>()
        return rows.flatMap((row): ReadonlyArray<RunWorkItem> => {
            const key = `${row.runId}:${row.workItemId ?? ""}`
            if (row.workItemId === null || seen.has(key)) return []
            seen.add(key)
            return [{ runId: row.runId, workItemId: row.workItemId }]
        })
    }
}
