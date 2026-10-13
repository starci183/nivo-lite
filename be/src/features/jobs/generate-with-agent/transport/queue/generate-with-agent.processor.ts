import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENTS_QUEUE, AgentsJob } from "@modules/queues/agents"
import { GenerateWithAgentStep } from "../../steps/generate-with-agent.step"

@Injectable()
/** The processor of the generate-with-agent job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class GenerateWithAgentProcessor extends FencedProcessor {
    readonly queue = AGENTS_QUEUE

    override readonly job = AgentsJob.Generate

    constructor(private readonly step: GenerateWithAgentStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
