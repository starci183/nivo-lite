import { Injectable } from "@nestjs/common"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed sepay receipt. */
export class ProcessSepayDeliveryStep implements JobStep {
    constructor(
        private readonly inbox: SepayTransactionsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the worker's fence before the domain consumer can perform its receipt effect. */
    run(job: ClaimedJob): Promise<void> {
        return this.inbox.processClaimedDelivery(job, this.claims)
    }
}
