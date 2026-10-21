import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { MARKETING_TICK_QUEUE } from "@modules/queues/marketing-tick"
import { RunMarketingTickStep } from "../../steps/run.step"

@Injectable()
/** The processor of the AI Marketing tick job: the one step runs it. */
export class RunMarketingTickProcessor extends FencedProcessor {
    readonly queue = MARKETING_TICK_QUEUE

    constructor(private readonly step: RunMarketingTickStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
