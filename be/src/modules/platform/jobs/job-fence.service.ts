import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { InjectJobsManagers } from "./jobs.decorators"
import type { JobFenceAction } from "./jobs.port"
import { LOCK_JOB_FENCE } from "./persistence/jobs.sql"

@Injectable()
/** Holds the current job row's lock while another capability writes its own rows. */
export class JobFenceService {
    constructor(@InjectJobsManagers() private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Rejects a stale token atomically with the domain write; a new claim waits until this transaction ends. */
    async write(job: ClaimedJob, action: JobFenceAction): Promise<void> {
        const [manager] = this.managers
        if (manager === undefined) throw new JobsError({ code: JobsErrorCode.ConnectionMissing })
        await manager.transaction(async (tx) => {
            const rows: Array<object> = await tx.query(LOCK_JOB_FENCE, [job.jobId, job.fencingToken])
            if (rows.length === 0) {
                throw new JobsError({
                    code: JobsErrorCode.FencedOut,
                    params: { jobId: job.jobId, token: job.fencingToken },
                })
            }
            await action(tx)
        })
    }
}
