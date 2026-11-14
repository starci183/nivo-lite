import { Injectable } from "@nestjs/common"
import { AgentRunsLimitService } from "@modules/domain/agent-runs"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { AGENT_TURN_QUEUE, AgentTurnJob } from "@modules/queues/agent-turn"
import { DrainStep } from "../../steps/drain.step"

@Injectable()
/**
 * The processor of the drain job of the agent-turn queue: the runner claims and settles it; `process` delegates to the one step. One
 * drain runs one turn of a run (each holds the lease of its own scope), so how many drains run at once IS how many runs execute at once:
 * the app's capacity (`AGENT_RUNS_CONCURRENCY`). A run that parks at a wait or a stop ends its turn, the drain completes and its slot is
 * free. Per workspace: `public.job_start` admits a job while the workspace's slots on EVERY queue are fewer than the app's workspace limit
 * (`QUEUE_WORKSPACE_CONCURRENCY`) plus the job's headroom; a drain's headroom is the runs one workspace may hold
 * (`AGENT_RUNS_WORKSPACE_CONCURRENCY`, default the whole capacity), so one workspace reaches N runs unless a shared deployment lowers it.
 */
export class RunAgentTurnProcessor extends FencedProcessor {
    readonly queue: "agent_turn" = AGENT_TURN_QUEUE

    override readonly job: AgentTurnJob.Drain = AgentTurnJob.Drain

    /** How many drains of this queue run at once: the app's agent-run capacity. */
    override readonly concurrency: number

    /** The runs one workspace may hold beyond the app's workspace limit: a drain's headroom. */
    override readonly workspaceHeadroom: number

    constructor(
        private readonly drain: DrainStep,
        limit: AgentRunsLimitService,
    ) {
        super()
        this.concurrency = limit.concurrency
        this.workspaceHeadroom = limit.workspaceConcurrency
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.drain.run(job)
    }
}
