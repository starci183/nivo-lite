import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { LOYALTY_COMMAND_QUEUE } from "@modules/queues/loyalty-command"
import { RunStep } from "../../steps/run.step"

@Injectable()
/** The processor of the run-loyalty-command job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RunLoyaltyCommandProcessor extends FencedProcessor {
    readonly queue = LOYALTY_COMMAND_QUEUE

    constructor(private readonly run: RunStep) {
        super()
    }

    /** Runs the command; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.run.run(job)
    }
}
