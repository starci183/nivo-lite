import { Injectable, Optional } from "@nestjs/common"
import { InjectAgentRunsOptions } from "./agent-runs.decorators"
import type { AgentRunsOptions } from "./agent-runs.options"
import { RUNS_CONCURRENCY, RUNS_CONCURRENCY_MAX } from "./policies/agent-runs.policy"

@Injectable()
/** How many runs one process drives at once: the app setting (`AGENT_RUNS_CONCURRENCY`) kept between 1 and the most, else the default of 4. */
export class AgentRunsLimitService {
    constructor(@Optional() @InjectAgentRunsOptions() private readonly options: AgentRunsOptions | null = null) {}

    /** The most runs this process drives at once. */
    get concurrency(): number {
        const set = this.options?.concurrency
        if (set === undefined || !Number.isInteger(set) || set < 1) return RUNS_CONCURRENCY
        return Math.min(set, RUNS_CONCURRENCY_MAX)
    }
}
