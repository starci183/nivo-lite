import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentRunRecoveryService } from "./agent-run-recovery.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsViewService } from "./agent-runs-view.service"
import type { OwnerCancelAnswer, OwnerCancelRequest, ThreadRunCancels } from "./agent-runs-engine.contracts"

/** The seats that may cancel a run: the people who govern the workspace's agents. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The status of a run the machine holds to try again later: cancelling it gives it up for good, as abandoning does. */
const PARKED = "parked"

@Injectable()
/**
 * The owner door to stop a run that is queued, running, waiting or parked: no further step runs, the run is marked cancelled with the
 * member and the moment, and any wait or timer it held is released. A parked run (held for a later try) is given up the way the owner's
 * abandon does it: closed as dead with who, off every resume pass. It never undoes what steps already sent or did. A run on a LangGraph
 * thread moves only through its stop: it is cancelled by the stop's skip when the stops registered (`setThreadStops`), else refused
 * with `thread_run`. A run of another workspace answers as one that does not exist, so no id is confirmed.
 */
export class AgentRunCancelService {
    private threadStops: ThreadRunCancels | null = null

    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly runs: AgentRunStoreService,
        private readonly view: AgentRunsViewService,
        private readonly recovery: AgentRunRecoveryService,
    ) {}

    /** Registers the stops of thread runs once the app has started; an app that runs no thread refuses such a run instead. */
    setThreadStops(stops: ThreadRunCancels): void {
        this.threadStops = stops
    }

    /** Cancels the run for an owner or manager of its workspace; refused for any other seat. */
    async cancel(request: OwnerCancelRequest): Promise<OwnerCancelAnswer> {
        await this.members.require(request.principalId, request.workspaceId, GOVERNORS)
        const actor = await this.members.idOf(request.principalId, request.workspaceId)
        const run = await this.runs.runById(request.workspaceId, request.runId)
        if (run?.workspaceId !== request.workspaceId) return { kind: "not_found", note: null }
        if ((await this.view.detail(run.workspaceId, run.agentId, run.id))?.engine === "langgraph")
            return this.threadStops === null ? { kind: "thread_run", note: null } : this.threadStops.skipRun(request)
        if (run.status === PARKED) {
            const abandoned = await this.recovery.abandon(run.workspaceId, run.id, actor)
            return abandoned === "abandoned" ? { kind: "cancelled", note: "effects_kept" } : { kind: "not_cancellable", note: null }
        }
        const result = await this.runs.cancel(request.workspaceId, run.id, actor)
        return { kind: result.kind, note: result.kind === "cancelled" ? "effects_kept" : null }
    }
}
