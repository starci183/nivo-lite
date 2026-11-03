import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENT_STEP_QUEUE, AgentStepJob } from "@modules/queues/agent-step"
import { AdvanceStep } from "../../steps/advance.step"

/** How many runs one process drives at once: each step is claimed under its own fence, so runs do not wait on each other. */
const ADVANCE_CONCURRENCY = 4

@Injectable()
/** The processor of the advance job of the agent-step queue: the runner claims and settles it; `process` delegates to the one step. */
export class RunAgentStepProcessor extends FencedProcessor {
    readonly queue: "agent_step" = AGENT_STEP_QUEUE

    override readonly job: AgentStepJob.Advance = AgentStepJob.Advance

    override readonly concurrency: 4 = ADVANCE_CONCURRENCY

    constructor(private readonly advance: AdvanceStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.advance.run(job)
    }
}
