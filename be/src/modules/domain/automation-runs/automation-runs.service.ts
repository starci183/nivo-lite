import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
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
import {
    CLAIM_RUN,
    FAIL_RUN,
    FINISH_RUN,
    INSERT_RUN,
    SELECT_DUE_RUNS,
    SELECT_LATEST_DONE_RUN,
    SELECT_PRIOR_RUNS,
    SELECT_RUNS,
    SELECT_WAITING_RUNS,
    UPDATE_RUN_PAYLOAD,
} from "./persistence/automation-runs.sql"

/** A run's attempts are capped here; the third failure is final. */
const MAX_ATTEMPTS = 3
const BACKOFF_MINUTES: ReadonlyArray<number> = [2, 10]
const LAST_BACKOFF_MINUTES = 30
const MINUTE_MS = 60_000
const ERROR_MAX = 500
const ERROR_DETAIL_MAX = 200
const LATER_THRESHOLD_MS = 1000

@Injectable()
/** The run records of public.automation_runs: one row per trigger, unique per pipeline and dedupe key, executed at most once per attempt. */
export class AutomationRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Records a trigger. A trigger scheduled for later is stored queued and answers null; a repeated trigger answers null too;
     * otherwise the run is stored running, its first attempt started, and answered.
     */
    async beginRun(params: BeginRun): Promise<ClaimedRunOrNone> {
        const now = this.clock.now()
        const later = params.runAt !== undefined && params.runAt.getTime() > now.getTime() + LATER_THRESHOLD_MS
        const [row] = await this.entityManager.query<Array<{ id: string; attempts: number }>>(INSERT_RUN, [
            params.pipelineId,
            params.workspaceId,
            params.triggerRef,
            params.dedupe,
            JSON.stringify(params.payload),
            later ? "queued" : "running",
            later ? 0 : 1,
            (params.runAt ?? now).toISOString(),
        ])
        return row === undefined || later ? null : { id: row.id, attempts: row.attempts, payload: params.payload }
    }

    /** The ids of the runs of a pipeline that are due: queued, or failed with attempts left. */
    async dueRunIds(pipelineId: string, now: Date, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(SELECT_DUE_RUNS, [
            pipelineId,
            MAX_ATTEMPTS,
            now.toISOString(),
            limit,
        ])
        return rows.map((row) => row.id)
    }

    /** Takes a queued or failed run that is due; none when another tick took it first. */
    async claimRun(runId: string): Promise<ClaimedRunOrNone> {
        const [row] = await this.entityManager.query<Array<ClaimedRun>>(CLAIM_RUN, [runId])
        return row ?? null
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
        await this.entityManager.query(FINISH_RUN, [
            runId,
            result.status,
            JSON.stringify(result.steps),
            result.evidence ?? null,
            result.status === "waiting_approval" ? null : this.clock.now().toISOString(),
        ])
    }

    /** Ends a run the owner decided: the waiting step is replaced by the answer. */
    async settleRun(settlement: RunSettlement): Promise<void> {
        await this.entityManager.query(FINISH_RUN, [
            settlement.runId,
            settlement.status,
            JSON.stringify(settlement.steps),
            settlement.evidence,
            this.clock.now().toISOString(),
        ])
    }

    /** The latest runs of a workspace, optionally of one template, newest first. */
    runsOf(query: RunsQuery): Promise<ReadonlyArray<RunRow>> {
        return this.entityManager.query<Array<RunRow>>(SELECT_RUNS, [query.workspaceId, query.templateKey, query.limit])
    }

    /** The history of a pipeline for some references. */
    priorRuns(pipelineId: string, references: ReadonlyArray<string>): Promise<ReadonlyArray<PriorRunRow>> {
        return references.length === 0
            ? Promise.resolve([])
            : this.entityManager.query<Array<PriorRunRow>>(SELECT_PRIOR_RUNS, [pipelineId, references])
    }

    /** The runs of a workspace that wait for a decision on one work item. */
    waitingRunsFor(workspaceId: string, workItemId: string): Promise<ReadonlyArray<WaitingRun>> {
        return this.entityManager.query<Array<WaitingRun>>(SELECT_WAITING_RUNS, [
            workspaceId,
            JSON.stringify([{ workItemId }]),
        ])
    }

    /** The latest finished run of a pipeline for one reference since an instant, or none. */
    async latestDoneRun(query: LatestRunQuery): Promise<ClaimedRunOrNone> {
        const [row] = await this.entityManager.query<Array<{ id: string; payload: RunPayload }>>(
            SELECT_LATEST_DONE_RUN,
            [query.pipelineId, query.reference, query.since],
        )
        return row === undefined ? null : { id: row.id, attempts: 0, payload: row.payload }
    }

    /** Replaces the payload of a run. */
    async markPayload(runId: string, payload: RunPayload): Promise<void> {
        await this.entityManager.query(UPDATE_RUN_PAYLOAD, [runId, JSON.stringify(payload)])
    }

    private async failRun(run: ClaimedRun, message: string): Promise<void> {
        const retry = run.attempts < MAX_ATTEMPTS
        const now = this.clock.now()
        const backoff = BACKOFF_MINUTES[run.attempts - 1] ?? LAST_BACKOFF_MINUTES
        await this.entityManager.query(FAIL_RUN, [
            run.id,
            message.slice(0, ERROR_MAX),
            new Date(now.getTime() + backoff * MINUTE_MS).toISOString(),
            retry ? null : now.toISOString(),
            JSON.stringify([
                {
                    label: this.catalog.get("automation-runs.step.failed", {}, "vi"),
                    status: "failed",
                    detail: message.slice(0, ERROR_DETAIL_MAX),
                },
            ]),
        ])
    }
}
