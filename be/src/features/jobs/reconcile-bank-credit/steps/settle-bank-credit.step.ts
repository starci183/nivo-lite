import { Injectable } from "@nestjs/common"
import { BankCreditSettlementService } from "@modules/domain/work-performers"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The one effect of the job: a credit that names exactly one issued invoice of its amount is reconciled by itself; any other waits
 * for the owner's check.
 */
export class SettleBankCreditStep implements JobStep {
    constructor(
        private readonly settlement: BankCreditSettlementService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then settles the
     * credit (its reconcile work is keyed on the credit, and an event already past the owner check is left as it is, so a repeat
     * changes nothing). Any other payload changes nothing.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "settle" })
        await this.settlement.settle(job.payload)
    }
}
