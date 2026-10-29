import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
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

/**
 * The upsert half of a claim: an existing key is claimed again only when the job failed or its lease expired, and then the
 * token is bumped by the store. A done job and a live claim match nothing, so no row comes back.
 */
const CLAIM_CONFLICT = `("job_key") DO UPDATE
    SET fencing_token = jobs.fencing_token + 1, claimed_by = :claimedBy, lease_expires_at = :leaseExpiresAt,
        status = 'running', error = NULL, updated_at = :now
    WHERE jobs.status = 'failed' OR (jobs.status = 'running' AND jobs.lease_expires_at < :now)`

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
        const result = await this.writer()
            .createQueryBuilder(JobEntity, "jobs")
            .insert()
            .values({
                kind: params.kind,
                jobKey: params.jobKey,
                status: "running",
                fencingToken: 1,
                claimedBy: params.workerId,
                leaseExpiresAt: new Date(now.getTime() + params.leaseMs),
                payload: params.payload,
                createdAt: now,
                updatedAt: now,
            })
            .onConflict(CLAIM_CONFLICT)
            .setParameter("claimedBy", params.workerId)
            .setParameter("leaseExpiresAt", new Date(now.getTime() + params.leaseMs))
            .setParameter("now", now)
            .returning("id, kind, fencing_token, current_step, payload")
            .execute()
        const [row] = result.raw as Array<{
            readonly id: string
            readonly kind: string
            readonly fencing_token: string
            readonly current_step: string | null
            readonly payload: object
        }>
        if (row === undefined) return null
        return {
            jobId: row.id,
            kind: row.kind,
            fencingToken: Number(row.fencing_token),
            currentStep: row.current_step,
            payload: row.payload,
        }
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
