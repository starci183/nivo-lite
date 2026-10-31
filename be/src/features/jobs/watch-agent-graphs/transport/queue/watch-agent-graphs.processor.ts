import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DECISIONS_QUEUE, DecisionsJob } from "@modules/queues/decisions"
import { WatchAgentGraphsStep } from "../../steps/watch-agent-graphs.step"

@Injectable()
/** The processor of the graphs tick of the decisions queue: the runner claims and settles it; `process` delegates to the one step. */
export class WatchAgentGraphsProcessor extends FencedProcessor {
    readonly queue = DECISIONS_QUEUE

    override readonly job = DecisionsJob.AgentGraphWatch

    constructor(private readonly step: WatchAgentGraphsStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
