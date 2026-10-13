import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"
import { RunAutomationsStep } from "../../steps/run-automations.step"

@Injectable()
/** The processor of the publish-content job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class PublishContentProcessor extends FencedProcessor {
    readonly queue = CONTENT_TICK_QUEUE

    constructor(private readonly automations: RunAutomationsStep) {
        super()
    }

    /** Runs the due automations; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.automations.run(job)
    }
}
