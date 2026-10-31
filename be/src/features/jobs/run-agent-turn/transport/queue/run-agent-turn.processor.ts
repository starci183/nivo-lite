import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENT_TURN_QUEUE, AgentTurnJob } from "@modules/queues/agent-turn"
import { DrainStep } from "../../steps/drain.step"

/** How many drains one process runs at once: each holds the lease of its own scope, so the agents do not wait on each other. */
const DRAIN_CONCURRENCY = 4

@Injectable()
/** The processor of the drain job of the agent-turn queue: the runner claims and settles it; `process` delegates to the one step. */
export class RunAgentTurnProcessor extends FencedProcessor {
    readonly queue = AGENT_TURN_QUEUE

    override readonly job = AgentTurnJob.Drain

    override readonly concurrency = DRAIN_CONCURRENCY

    constructor(private readonly drain: DrainStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.drain.run(job)
    }
}
