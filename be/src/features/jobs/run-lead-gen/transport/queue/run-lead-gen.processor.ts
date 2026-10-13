import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CONTINUE_LEAD_GEN_JOB, LEAD_GEN_QUEUE } from "@modules/queues/lead-gen"
import { ContinueLeadGenStep } from "../../steps/continue-lead-gen.step"

@Injectable()
/** The lead generation queue consumer, with the standard fencing. */
export class RunLeadGenProcessor extends FencedProcessor {
    readonly queue = LEAD_GEN_QUEUE
    override readonly job = CONTINUE_LEAD_GEN_JOB

    constructor(private readonly step: ContinueLeadGenStep) {
        super()
    }

    /** Runs the continuation under the runner's claim. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
