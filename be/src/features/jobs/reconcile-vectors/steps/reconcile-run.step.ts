import { Injectable } from "@nestjs/common"
import { VectorReconcileService } from "@modules/domain/vector-sync"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: one bounded run of the reconcile of the vector index against Postgres, from the stored cursors. */
export class ReconcileRunStep implements JobStep {
    constructor(
        private readonly vectors: VectorReconcileService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then does the work. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "reconcile" })
        await this.vectors.run()
    }
}
