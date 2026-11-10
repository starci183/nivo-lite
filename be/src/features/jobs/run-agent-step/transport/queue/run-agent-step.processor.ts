import { Injectable } from "@nestjs/common"
import { AgentRunsLimitService } from "@modules/domain/agent-runs"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENT_STEP_QUEUE, AgentStepJob } from "@modules/queues/agent-step"
import { AdvanceStep } from "../../steps/advance.step"

@Injectable()
/** The processor of the advance job of the agent-step queue: the runner claims and settles it; `process` delegates to the one step. */
export class RunAgentStepProcessor extends FencedProcessor {
    readonly queue: "agent_step" = AGENT_STEP_QUEUE

    override readonly job: AgentStepJob.Advance = AgentStepJob.Advance

    /** How many runs one process drives at once: the app setting (`AGENT_RUNS_CONCURRENCY`, 4 by default); each step is claimed under its own fence, so runs do not wait on each other. */
    override readonly concurrency: number

    constructor(
        private readonly advance: AdvanceStep,
        limit: AgentRunsLimitService,
    ) {
        super()
        this.concurrency = limit.concurrency
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.advance.run(job)
    }
}
