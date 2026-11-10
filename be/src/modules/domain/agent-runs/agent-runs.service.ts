import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { RunOpen } from "./agent-runs.contracts"
import type { OptionalRunId, OptionalRunView, RunView } from "./agent-runs-engine.contracts"

@Injectable()
/**
 * The door to the runs for the other capabilities: one run per wake (the graph flows and the inbound door open it), and the reads the
 * thread runs, the stop door, the call guard and the stop holds make of it. It drives nothing: a run moves only through its LangGraph
 * thread (agent-threads), whose projection writes the run's step rows.
 */
export class AgentRunsService {
    constructor(private readonly store: AgentRunStoreService) {}

    /** Opens the one run of a wake in `tx`; a replay of the same wake answers the run it already has. */
    open(tx: EntityManager, input: RunOpen): Promise<RunView> {
        return this.store.open(tx, input)
    }

    /** The run, or null when there is none: what a notice about it needs to name its workspace, agent and conversation. */
    runOf(workspaceId: string, runId: string): Promise<OptionalRunView> {
        return this.store.runById(workspaceId, runId)
    }

    /** The id of the run of a wake, or null when the wake has none: what a model call made for the wake is booked to. */
    async runIdOfWake(workspaceId: string, wakeId: string): Promise<OptionalRunId> {
        return (await this.store.runOfWake(workspaceId, wakeId))?.id ?? null
    }
}
