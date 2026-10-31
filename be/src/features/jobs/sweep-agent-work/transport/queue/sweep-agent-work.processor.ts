import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENT_TURN_QUEUE, AgentTurnJob } from "@modules/queues/agent-turn"
import { SweepAgentWorkStep } from "../../steps/sweep-agent-work.step"

@Injectable()
/** The processor of the minute tick of the agent-turn queue: the runner claims and settles it; `process` delegates to the one step. */
export class SweepAgentWorkProcessor extends FencedProcessor {
    readonly queue = AGENT_TURN_QUEUE

    override readonly job = AgentTurnJob.Sweep

    constructor(private readonly sweep: SweepAgentWorkStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.sweep.run(job)
    }
}
