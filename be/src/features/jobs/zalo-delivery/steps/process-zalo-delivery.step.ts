import { Injectable } from "@nestjs/common"
import { ZaloDeliveryPolicy, ZaloInboxService } from "@modules/domain/zalo-inbox"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed zalo receipt. */
export class ProcessZaloDeliveryStep implements JobStep {
    constructor(
        private readonly delivery: ZaloDeliveryPolicy,
        private readonly inbox: ZaloInboxService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Delegates receipt validation and fenced processing to its owner. */
    run(job: ClaimedJob): Promise<void> {
        return this.delivery.run(job, this.claims, this.inbox)
    }
}
