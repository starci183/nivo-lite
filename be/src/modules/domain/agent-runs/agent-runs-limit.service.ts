import { Injectable, Optional } from "@nestjs/common"
import { InjectAgentRunsOptions } from "./agent-runs.decorators"
import type { AgentRunsOptions } from "./agent-runs.options"
import { RUNS_CONCURRENCY, RUNS_CONCURRENCY_MAX } from "./policies/agent-runs.policy"

/** A whole number of at least one, else undefined. */
const countOf = (value: number | undefined): number | undefined =>
    value !== undefined && Number.isInteger(value) && value >= 1 ? value : undefined

@Injectable()
/**
 * The capacity of the runs: how many execute at once (`AGENT_RUNS_CONCURRENCY`, default 100: the drains of the agent-turn queue the api
 * runs at once; a parked run holds none), kept between 1 and the most, and how many of them one workspace may hold
 * (`AGENT_RUNS_WORKSPACE_CONCURRENCY`, default the whole capacity: a self-hosted install has one workspace and reaches N; a shared
 * multi-tenant deployment sets it lower). No package, graph or node reads it.
 */
export class AgentRunsLimitService {
    constructor(@Optional() @InjectAgentRunsOptions() private readonly options: AgentRunsOptions | null = null) {}

    /** The most runs that execute at once. */
    get concurrency(): number {
        const set = countOf(this.options?.concurrency)
        return set === undefined ? RUNS_CONCURRENCY : Math.min(set, RUNS_CONCURRENCY_MAX)
    }

    /** The most runs of one workspace that execute at once: the setting, never above the capacity; the whole capacity when unset. */
    get workspaceConcurrency(): number {
        const set = countOf(this.options?.workspaceConcurrency)
        return set === undefined ? this.concurrency : Math.min(set, this.concurrency)
    }
}
