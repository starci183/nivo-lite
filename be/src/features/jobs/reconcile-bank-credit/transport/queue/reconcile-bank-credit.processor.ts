import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BANK_CREDIT_QUEUE } from "@modules/queues/bank-credit"
import { HoldForOwnerCheckStep } from "../../steps/hold-for-owner-check.step"

@Injectable()
/** The processor of the reconcile-bank-credit job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ReconcileBankCreditProcessor extends FencedProcessor {
    readonly queue = BANK_CREDIT_QUEUE

    constructor(private readonly holdForOwnerCheck: HoldForOwnerCheckStep) {
        super()
    }

    /** Holds the credit for the owner; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.holdForOwnerCheck.run(job)
    }
}
