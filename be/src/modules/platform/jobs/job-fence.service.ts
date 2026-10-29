import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { InjectJobsManagers } from "./jobs.decorators"
import type { JobFenceAction } from "./jobs.port"
import { JobEntity } from "./persistence/entities"

@Injectable()
/** Holds the current job row's lock while another capability writes its own rows. */
export class JobFenceService {
    constructor(@InjectJobsManagers() private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Rejects a stale token atomically with the domain write; a new claim waits until this transaction ends. */
    async write(job: ClaimedJob, action: JobFenceAction): Promise<void> {
        const [manager] = this.managers
        if (manager === undefined) throw new JobsError({ code: JobsErrorCode.ConnectionMissing })
        await manager.transaction(async (tx) => {
            const fence = await tx
                .createQueryBuilder(JobEntity, "job")
                .select("job.id")
                .where("job.id = :jobId AND job.fencingToken = :token AND job.status = :running", {
                    jobId: job.jobId,
                    token: job.fencingToken,
                    running: "running",
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
            await action(tx)
        })
    }
}
