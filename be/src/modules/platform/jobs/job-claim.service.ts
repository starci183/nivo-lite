import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { sql } from "@modules/platform/database"
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
import {
    ADVANCE_JOB,
    CLAIM_JOB,
    COMPLETE_JOB,
    FAIL_JOB,
    LOCK_JOB_FENCE,
    LOCK_FAILED_JOB_FENCE,
    JOB_CLAIM_STATE,
} from "./persistence/jobs.sql"
import type { ClaimedRow, JobClaimStateRow } from "./persistence/jobs.rows"

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
        const rows: Array<ClaimedRow> = await this.writer().query(CLAIM_JOB, [
            params.kind,
            params.jobKey,
            params.workerId,
            new Date(now.getTime() + params.leaseMs),
            JSON.stringify(params.payload),
            now,
        ])
        const row = rows[0]
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
        const [row] = await this.writer().query<Array<JobClaimStateRow>>(JOB_CLAIM_STATE, [jobKey])
        if (row?.status === "done") return null
        const lease = row?.lease_expires_at?.getTime() ?? this.clock.now().getTime()
        return Math.min(3600, Math.max(1, Math.ceil((lease - this.clock.now().getTime()) / 1000)))
    }

    /** Records a finished step under the token the caller holds. */
    advance(write: AdvanceWrite): Promise<void> {
        return this.guarded(ADVANCE_JOB, [write.jobId, write.expectedFencingToken, write.step, this.clock.now()], write)
    }

    /** Completes the job under the token the caller holds. */
    complete(write: GuardedWrite): Promise<void> {
        return this.guarded(COMPLETE_JOB, [write.jobId, write.expectedFencingToken, this.clock.now()], write)
    }

    /** Marks the job failed under the token the caller holds, so the queue can retry it. */
    fail(write: FailWrite): Promise<void> {
        return this.guarded(FAIL_JOB, [write.jobId, write.expectedFencingToken, write.reason, this.clock.now()], write)
    }

    /** Holds the live fence across domain effects; no job-row writes may be attempted inside the callback. */
    withFence<T>(job: ClaimedJob, work: JobEffect<T>): Promise<T> {
        return this.writer().transaction(async (manager) => {
            const rows = await manager.query<Array<{ id: string }>>(LOCK_JOB_FENCE, [job.jobId, job.fencingToken])
            if (rows.length === 0) {
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
            const [row] = await manager.query<Array<{ id: string; fencing_token: string }>>(LOCK_FAILED_JOB_FENCE, [
                jobKey,
            ])
            if (row === undefined) return
            await work({ jobId: row.id, expectedFencingToken: Number(row.fencing_token) })
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
    private async guarded(
        statement: ReturnType<typeof sql>,
        parameters: Array<unknown>,
        write: GuardedWrite,
    ): Promise<void> {
        const rows: Array<object> = await this.writer().query(statement, parameters)
        if (rows.length === 0) {
            throw new JobsError({
                code: JobsErrorCode.FencedOut,
                params: { jobId: write.jobId, token: write.expectedFencingToken },
            })
        }
    }
}
