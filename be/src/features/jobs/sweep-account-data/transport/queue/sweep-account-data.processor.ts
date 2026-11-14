import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { ACCOUNT_DATA_RETENTION_QUEUE } from "@modules/queues/account-data-retention"
import { SweepAccountDataStep } from "../../steps/sweep-account-data.step"

@Injectable()
/** The processor of the sweep-account-data job: the runner claims and settles every end-of-day tick; `process` delegates to the one step. */
export class SweepAccountDataProcessor extends FencedProcessor {
    readonly queue: "account_data_retention" = ACCOUNT_DATA_RETENTION_QUEUE

    constructor(private readonly sweep: SweepAccountDataStep) {
        super()
    }

    /** Sweeps the expired account data; a stale token throws the fenced-out error from the guarded write before a batch. */
    async process(job: ClaimedJob): Promise<void> {
        await this.sweep.run(job)
    }
}
