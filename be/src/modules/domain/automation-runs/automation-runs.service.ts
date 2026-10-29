import { Injectable } from "@nestjs/common"
import { In, LessThan, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    BeginRun,
    ClaimedRun,
    ClaimedRunOrNone,
    LatestRunQuery,
    PriorRunRow,
    RunExecution,
    RunPayload,
    RunResult,
    RunRow,
    RunSettlement,
    RunsQuery,
    RunStatus,
    WaitingRun,
} from "./automation-runs.contracts"
import { AutomationRunsLogEvent } from "./automation-runs.log-events"
import { AutomationRunEntity } from "./persistence/entities"

/** A run's attempts are capped here; the third failure is final. */
const MAX_ATTEMPTS = 3
const BACKOFF_MINUTES: ReadonlyArray<number> = [2, 10]
const LAST_BACKOFF_MINUTES = 30
const MINUTE_MS = 60_000
const ERROR_MAX = 500
const ERROR_DETAIL_MAX = 200
const LATER_THRESHOLD_MS = 1000
const PRIOR_LIMIT = 5000
const WAITING_LIMIT = 50

/** The statement fragment that stores the bound payload text as jsonb. */
const PAYLOAD_JSON = () => "CAST(:payload AS jsonb)"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isRows = (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value)

/** The id and attempts of the first row of a `RETURNING` clause, or none. */
const startedOf = (raw: unknown): { id: string; attempts: number } | undefined => {
    const [row] = isRows(raw) ? raw : []
    return isRecord(row) && typeof row.id === "string" && typeof row.attempts === "number"
        ? { id: row.id, attempts: row.attempts }
        : undefined
}

/** The claimed run of the first row of a `RETURNING` clause, or none. */
const claimedOf = (raw: unknown): ClaimedRun | undefined => {
    const started = startedOf(raw)
    const [row] = isRows(raw) ? raw : []
    return started === undefined || !isRecord(row) || !isRecord(row.payload)
        ? undefined
        : { ...started, payload: row.payload }
}

@Injectable()
/** The run records of public.automation_runs: one row per trigger, unique per pipeline and dedupe key, executed at most once per attempt. */
export class AutomationRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly pipelines: AutomationPipelinesService,
    ) {}

    /**
     * Records a trigger. A trigger scheduled for later is stored queued and answers null; a repeated trigger answers null too;
     * otherwise the run is stored running, its first attempt started, and answered.
     */
    async beginRun(params: BeginRun): Promise<ClaimedRunOrNone> {
        const now = this.clock.now()
        const later = params.runAt !== undefined && params.runAt.getTime() > now.getTime() + LATER_THRESHOLD_MS
        const inserted = await this.entityManager
            .createQueryBuilder(AutomationRunEntity, "ar")
            .insert()
            .values({
                pipelineId: params.pipelineId,
                workspaceId: params.workspaceId,
                triggerRef: params.triggerRef,
                dedupeKey: params.dedupe,
                payload: PAYLOAD_JSON,
                status: later ? "queued" : "running",
                attempts: later ? 0 : 1,
                runAt: params.runAt ?? now,
            })
            .setParameter("payload", JSON.stringify(params.payload))
            .orIgnore()
            .returning(["id", "attempts"])
            .execute()
        const row = startedOf(inserted.raw)
        return row === undefined || later ? null : { id: row.id, attempts: row.attempts, payload: params.payload }
    }

    /** The ids of the runs of a pipeline that are due: queued, or failed with attempts left. */
    async dueRunIds(pipelineId: string, now: Date, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(AutomationRunEntity, {
            select: { id: true },
            where: {
                pipelineId,
                status: In(["queued", "failed"]),
                attempts: LessThan(MAX_ATTEMPTS),
                runAt: LessThanOrEqual(now),
            },
            order: { runAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => row.id)
    }

    /** Takes a queued or failed run that is due; none when another tick took it first. */
    async claimRun(runId: string): Promise<ClaimedRunOrNone> {
        const claimed = await this.entityManager
            .createQueryBuilder(AutomationRunEntity, "ar")
            .update()
            .set({ status: "running", attempts: () => "attempts + 1", error: null })
            .where({ id: runId, status: In(["queued", "failed"]) })
            .returning(["id", "attempts", "payload"])
            .execute()
        return claimedOf(claimed.raw) ?? null
    }

    /** Runs one execution for one claimed run: any exception becomes a failed run that is retried with backoff. */
    async executeRun(run: ClaimedRun, execution: RunExecution): Promise<RunStatus> {
        try {
            const result = await execution()
            await this.finishRun(run.id, result)
            return result.status
        } catch (cause) {
            this.logger.error(AutomationRunsLogEvent.RunFailed, cause, { runId: run.id, attempt: run.attempts })
            await this.failRun(run, cause instanceof Error ? cause.message : String(cause))
            return "failed"
        }
    }

    /** Ends a run with its result. */
    async finishRun(runId: string, result: RunResult): Promise<void> {
        await this.entityManager.update(
            AutomationRunEntity,
            { id: runId },
            {
                status: result.status,
                steps: [...result.steps],
                evidence: result.evidence ?? null,
                error: null,
                finishedAt: result.status === "waiting_approval" ? null : this.clock.now(),
            },
        )
    }

    /** Ends a run the owner decided: the waiting step is replaced by the answer. */
    async settleRun(settlement: RunSettlement): Promise<void> {
        await this.entityManager.update(
            AutomationRunEntity,
            { id: settlement.runId },
            {
                status: settlement.status,
                steps: [...settlement.steps],
                evidence: settlement.evidence,
                error: null,
                finishedAt: this.clock.now(),
            },
        )
    }

    /** The latest runs of a workspace, optionally of one template, newest first. */
    async runsOf(query: RunsQuery): Promise<ReadonlyArray<RunRow>> {
        const pipelineIds =
            query.templateKey === null
                ? null
                : (await this.pipelines.pipelineKeys(query.workspaceId))
                      .filter((key) => key.template_key === query.templateKey)
                      .map((key) => key.id)
        if (pipelineIds?.length === 0) return []
        const rows = await this.entityManager.find(AutomationRunEntity, {
            where: pipelineIds === null ? { workspaceId: query.workspaceId } : { workspaceId: query.workspaceId, pipelineId: In(pipelineIds) },
            order: { createdAt: "DESC" },
            take: query.limit,
        })
        return rows.map((row) => ({
            id: row.id,
            pipeline_id: row.pipelineId,
            trigger_ref: row.triggerRef,
            status: row.status,
            steps: row.steps,
            evidence: row.evidence,
            error: row.error,
            created_at: row.createdAt.toISOString(),
            finished_at: row.finishedAt === null ? null : row.finishedAt.toISOString(),
        }))
    }

    /** The history of a pipeline for some references. */
    async priorRuns(pipelineId: string, references: ReadonlyArray<string>): Promise<ReadonlyArray<PriorRunRow>> {
        if (references.length === 0) return []
        const rows = await this.entityManager.find(AutomationRunEntity, {
            select: { triggerRef: true, status: true, createdAt: true, dedupeKey: true },
            where: { pipelineId, triggerRef: In([...references]) },
            take: PRIOR_LIMIT,
        })
        return rows.map((row) => ({
            trigger_ref: row.triggerRef,
            status: row.status,
            created_at: row.createdAt.toISOString(),
            dedupe_key: row.dedupeKey,
        }))
    }

    /** The runs of a workspace that wait for a decision on one work item. */
    async waitingRunsFor(workspaceId: string, workItemId: string): Promise<ReadonlyArray<WaitingRun>> {
        const rows = await this.entityManager
            .createQueryBuilder(AutomationRunEntity, "r")
            .where("r.workspaceId = :workspaceId", { workspaceId })
            .andWhere("r.status = :status", { status: "waiting_approval" })
            .andWhere("r.steps @> CAST(:fragment AS jsonb)", { fragment: JSON.stringify([{ workItemId }]) })
            .limit(WAITING_LIMIT)
            .getMany()
        return rows.map((row) => ({ id: row.id, pipeline_id: row.pipelineId, steps: row.steps }))
    }

    /** The latest finished run of a pipeline for one reference since an instant, or none. */
    async latestDoneRun(query: LatestRunQuery): Promise<ClaimedRunOrNone> {
        const row = await this.entityManager.findOne(AutomationRunEntity, {
            select: { id: true, payload: true },
            where: {
                pipelineId: query.pipelineId,
                triggerRef: query.reference,
                status: "done",
                createdAt: MoreThanOrEqual(new Date(query.since)),
            },
            order: { createdAt: "DESC" },
        })
        return row === null ? null : { id: row.id, attempts: 0, payload: row.payload }
    }

    /** Replaces the payload of a run. */
    async markPayload(runId: string, payload: RunPayload): Promise<void> {
        await this.entityManager
            .createQueryBuilder(AutomationRunEntity, "ar")
            .update()
            .set({ payload: PAYLOAD_JSON })
            .where({ id: runId })
            .setParameter("payload", JSON.stringify(payload))
            .execute()
    }

    private async failRun(run: ClaimedRun, message: string): Promise<void> {
        const retry = run.attempts < MAX_ATTEMPTS
        const now = this.clock.now()
        const backoff = BACKOFF_MINUTES[run.attempts - 1] ?? LAST_BACKOFF_MINUTES
        await this.entityManager.update(
            AutomationRunEntity,
            { id: run.id },
            {
                status: "failed",
                error: message.slice(0, ERROR_MAX),
                runAt: new Date(now.getTime() + backoff * MINUTE_MS),
                finishedAt: retry ? null : now,
                steps: [
                    {
                        label: this.catalog.get("automation-runs.step.failed", {}, "vi"),
                        status: "failed",
                        detail: message.slice(0, ERROR_DETAIL_MAX),
                    },
                ],
            },
        )
    }
}
