import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsViewService } from "./agent-runs-view.service"
import type { OwnerCancelAnswer, OwnerCancelRequest, ThreadRunCancels } from "./agent-runs-engine.contracts"

/** The seats that may cancel a run: the people who govern the workspace's agents. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * The owner door to stop a run. A run on a LangGraph thread (every run the engine opens) moves only through its stop: it is cancelled by
 * the stop's skip when the stops registered (`setThreadStops`), else refused with `thread_run`. A history row of the old engine
 * (`legacy`, never resumed as a thread) that is still running or waiting is only marked cancelled with the member and the moment; one
 * that ended or was parked is not cancellable. It never undoes what steps already sent or did. A run of another workspace answers as one
 * that does not exist, so no id is confirmed.
 */
export class AgentRunCancelService {
    private threadStops: ThreadRunCancels | null = null

    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly runs: AgentRunStoreService,
        private readonly view: AgentRunsViewService,
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
        const result = await this.runs.cancel(request.workspaceId, run.id, actor)
        return { kind: result.kind, note: result.kind === "cancelled" ? "effects_kept" : null }
    }
}
