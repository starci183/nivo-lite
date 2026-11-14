import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunStoreService, type RunSubject, type SubjectHolder } from "./agent-run-store.service"
import type { RunOpen } from "./agent-runs.contracts"
import type { OptionalRunId, OptionalRunView, RunView } from "./agent-runs-engine.contracts"
import type { RunWaiterFilter, StoredWaiter } from "./agent-runs-rows.contracts"

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

    /** The run of a workflow in flight for one subject, or null (exact, by the subject index): the run an event of that subject waits for. */
    inFlightOf(workspaceId: string, workflowId: string, subject: RunSubject): Promise<OptionalRunView> {
        return this.store.inFlightOf(workspaceId, workflowId, subject)
    }

    /** Ends, in `tx`, every thread run of any agent parked on one of these subjects, with the typed reason `code`; the runs it ended. */
    endParkedOfSubjects(
        tx: EntityManager,
        workspaceId: string,
        subjects: ReadonlyArray<RunSubject>,
        code: string,
    ): Promise<ReadonlyArray<RunView>> {
        return this.store.endParkedOfSubjects(tx, workspaceId, subjects, code)
    }

    /** The agent's runs parked (waiting) for one subject, oldest first: where the waits of that subject are looked for first. */
    /** The thread runs in flight for one subject, whatever the workflow, oldest first: the runs that hold it (rule Q-1). */
    inFlightOfSubject(workspaceId: string, subject: RunSubject): Promise<ReadonlyArray<SubjectHolder>> {
        return this.store.inFlightOfSubject(workspaceId, subject)
    }

    parkedOfSubject(workspaceId: string, agentId: string, subject: RunSubject): Promise<ReadonlyArray<RunView>> {
        return this.store.parkedOfSubject(workspaceId, agentId, subject)
    }

    /** The workspace's thread runs parked at a `wait`, newest start first, at most `limit` (the dev Sandbox page's list, R66). */
    parkedAtWait(workspaceId: string, limit: number): Promise<ReadonlyArray<RunView>> {
        return this.store.parkedAtWait(workspaceId, limit)
    }

    /** Marks the wait a run parks on with the keys an event finds it by; an empty list clears the mark (the wait has what came). */
    markWait(workspaceId: string, runId: string, match: ReadonlyArray<string>): Promise<void> {
        return this.store.markWait(workspaceId, runId, match)
    }

    /** Every thread run of the agents, running or waiting, whose parked wait's keys the event's probe names (exact; no page). */
    waitersOf(workspaceId: string, filter: Omit<RunWaiterFilter, "statuses" | "engine">): Promise<ReadonlyArray<StoredWaiter>> {
        return this.store.waitersOf(workspaceId, filter)
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
