import { Injectable } from "@nestjs/common"
import { ZaloReconcileService } from "@modules/domain/zalo-provider"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: every Zalo connection that holds a token is read back for the customer messages its webhook never delivered, then its new customers are named. */
export class ReconcileInboxStep implements JobStep {
    constructor(
        private readonly reconcile: ZaloReconcileService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then reconciles. A payload that is not a poll payload does nothing. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "reconcile" })
        await this.reconcile.run(job.payload)
    }
}
