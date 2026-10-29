import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { returnedRows, rowShape } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import { isRunKey } from "./jobs.contracts"
import type {
    AdvanceWrite,
    ClaimedJob,
    ClaimParams,
    ClaimResult,
    ClaimRetryDelay,
    FailWrite,
    FailedJobEffect,
    JobEffect,
    GuardedWrite,
    RunKey,
} from "./jobs.contracts"
import { InjectJobsManagers } from "./jobs.decorators"
import type { JobClaims } from "./jobs.port"
import { JobEntity } from "./persistence/entities"
import type { JobState } from "./persistence/entities"

/** The columns a claim answers, as the database names them. */
const CLAIM_COLUMNS = "id, kind, fencing_token, current_step, payload"

/** The row a claim returns: the job with its bumped token (a bigint the driver hands back as text) and the step it stopped at. */
interface ClaimedRow {
    readonly id: string
    readonly kind: string
    readonly fencing_token: string
    readonly current_step: string | null
    readonly payload: object
}

/** Whether a returned column set has the claim's shape; the payload is checked on top, for it must be an object. */
const hasClaimShape = rowShape({
    id: "string",
    kind: "string",
    fencing_token: "string",
    current_step: "string?",
    payload: "json",
})

/** The guard of the rows a claim returns. */
const isClaimedRow = (value: unknown): value is ClaimedRow => hasClaimShape(value) && isRecord(value.payload)

/**
 * A re-claim takes a job whose delivery failed or whose lease lapsed; a done job and a live claim match nothing. The store bumps
 * the token in the same statement, so two workers can never hold the same one.
 */
const RECLAIMABLE =
    "jobs.jobKey = :jobKey AND (jobs.status = :failed OR (jobs.status = :running AND jobs.leaseExpiresAt < :now))"

/** The claim a returned row stands for. */
const claimResultOf = (row: ClaimedRow): ClaimedJob => ({
    jobId: row.id,
    kind: row.kind,
    fencingToken: Number(row.fencing_token),
    currentStep: row.current_step,
    payload: row.payload,
})

@Injectable()
/**
 * The one owner of the job row. A claim is one atomic upsert that bumps the fencing token in the store, so two workers can never
 * hold the same token; every other write is `WHERE fencing_token = <expected>`, so a worker that lost its claim (a zombie) changes
 * nothing and learns it from `JobFencedOut`.
 */
export class JobClaimService implements JobClaims {
    constructor(
        @InjectJobsManagers() private readonly managers: ReadonlyArray<EntityManager>,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Claims the delivery; null when the job is done or another worker holds a claim that has not expired. */
    async claim(params: ClaimParams): Promise<ClaimResult> {
        const now = this.clock.now()
        const leaseExpiresAt = new Date(now.getTime() + params.leaseMs)
        const inserted = await this.writer()
            .createQueryBuilder(JobEntity, "jobs")
            .insert()
            .values({
                kind: params.kind,
                jobKey: params.jobKey,
                status: "running",
                fencingToken: 1,
                claimedBy: params.workerId,
                leaseExpiresAt,
                payload: params.payload,
                createdAt: now,
                updatedAt: now,
            })
            .orIgnore()
            .returning(CLAIM_COLUMNS)
            .execute()
        const [first] = returnedRows(inserted.raw, isClaimedRow)
        if (first !== undefined) return claimResultOf(first)
        const reclaimed = await this.writer()
            .createQueryBuilder(JobEntity, "jobs")
            .update()
            .set({
                fencingToken: () => "fencing_token + 1",
                claimedBy: params.workerId,
                leaseExpiresAt,
                status: "running",
                error: null,
                updatedAt: now,
            })
            .where(RECLAIMABLE, {
                jobKey: params.jobKey,
                failed: "failed" satisfies JobState,
                running: "running" satisfies JobState,
                now,
            })
            .returning(CLAIM_COLUMNS)
            .execute()
        const [row] = returnedRows(reclaimed.raw, isClaimedRow)
        return row === undefined ? null : claimResultOf(row)
    }

    /** A refused claim completes only after confirmed success; races and live leases defer without spending an attempt. */
    async retryAfterSeconds(jobKey: string): Promise<ClaimRetryDelay> {
        const row = await this.writer().findOne(JobEntity, {
            select: { status: true, leaseExpiresAt: true },
            where: { jobKey },
        })
        if (row?.status === "done") return null
        const lease = row?.leaseExpiresAt?.getTime() ?? this.clock.now().getTime()
        return Math.min(3600, Math.max(1, Math.ceil((lease - this.clock.now().getTime()) / 1000)))
    }

    /** Records a finished step under the token the caller holds. */
    advance(write: AdvanceWrite): Promise<void> {
        return this.guarded({ currentStep: write.step, updatedAt: this.clock.now() }, write)
    }

    /** Completes the job under the token the caller holds. */
    complete(write: GuardedWrite): Promise<void> {
        return this.guarded({ status: "done", leaseExpiresAt: null, updatedAt: this.clock.now() }, write)
    }

    /** Marks the job failed under the token the caller holds, so the queue can retry it. */
    fail(write: FailWrite): Promise<void> {
        return this.guarded(
            { status: "failed", error: write.reason, leaseExpiresAt: null, updatedAt: this.clock.now() },
            write,
        )
    }

    /** Holds the live fence across domain effects; no job-row writes may be attempted inside the callback. */
    withFence<T>(job: ClaimedJob, work: JobEffect<T>): Promise<T> {
        return this.writer().transaction(async (manager) => {
            const fence = await manager
                .createQueryBuilder(JobEntity, "job")
                .select("job.id")
                .where("job.id = :jobId AND job.fencingToken = :token AND job.status = :running", {
                    jobId: job.jobId,
                    token: job.fencingToken,
                    running: "running" satisfies JobState,
                })
                .limit(1)
                .setLock("pessimistic_write")
                .getOne()
            if (fence === null) {
                throw new JobsError({
                    code: JobsErrorCode.FencedOut,
                    params: { jobId: job.jobId, token: job.fencingToken },
                })
            }
            return work()
        })
    }

    /** Runs a terminal delivery effect under its latest failed claim, so it cannot overwrite a live successor. */
    withFailedFence(jobKey: string, work: FailedJobEffect): Promise<void> {
        return this.writer().transaction(async (manager) => {
            const row = await manager
                .createQueryBuilder(JobEntity, "job")
                .select(["job.id", "job.fencingToken"])
                .where("job.jobKey = :jobKey AND job.status = :failed", { jobKey, failed: "failed" satisfies JobState })
                .limit(1)
                .setLock("pessimistic_write")
                .getOne()
            if (row === null) return
            await work({ jobId: row.id, expectedFencingToken: row.fencingToken })
        })
    }

    /** The idempotency key of one step of this claim: it includes the token, so a zombie's repeat is a different key than the live worker's. */
    runKey(job: ClaimedJob, step: string): RunKey {
        const key = `${job.jobId}:${step}:${job.fencingToken}`
        if (!isRunKey(key))
            throw new JobsError({ code: JobsErrorCode.RunKeyInvalid, params: { jobId: job.jobId, step } })
        return key
    }

    /** The entity manager of the connection that holds the job table. */
    private writer(): EntityManager {
        const [manager] = this.managers
        if (manager === undefined) throw new JobsError({ code: JobsErrorCode.ConnectionMissing })
        return manager
    }

    /** Runs a statement that updates only when the token still matches; no row updated means a newer worker owns the job. */
    private async guarded(changes: QueryDeepPartialEntity<JobEntity>, write: GuardedWrite): Promise<void> {
        const result = await this.writer().update(
            JobEntity,
            { id: write.jobId, fencingToken: write.expectedFencingToken, status: "running" },
            changes,
        )
        if (result.affected === 0) {
            throw new JobsError({
                code: JobsErrorCode.FencedOut,
                params: { jobId: write.jobId, token: write.expectedFencingToken },
            })
        }
    }
}
