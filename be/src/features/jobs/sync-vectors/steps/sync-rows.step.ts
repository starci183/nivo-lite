import { Injectable } from "@nestjs/common"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the points of the rows the claimed job names are brought in step with the rows (Postgres is read again; the payload only names them). */
export class SyncRowsStep implements JobStep {
    constructor(
        private readonly vectors: VectorSyncService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then does the work. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sync" })
        await this.vectors.sync(job.payload)
    }
}
