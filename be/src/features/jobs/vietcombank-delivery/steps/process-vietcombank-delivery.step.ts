import { Injectable } from "@nestjs/common"
import { BankFeedService } from "@modules/domain/billing"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed vietcombank receipt. */
export class ProcessVietcombankDeliveryStep implements JobStep {
    constructor(
        private readonly inbox: BankFeedService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the worker's fence before the domain consumer can perform its receipt effect. */
    run(job: ClaimedJob): Promise<void> {
        return this.inbox.processRecordedDeliveryJob(job, this.claims)
    }
}
