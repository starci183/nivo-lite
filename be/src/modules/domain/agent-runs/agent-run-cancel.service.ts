import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { OwnerCancelAnswer, OwnerCancelRequest } from "./agent-runs-engine.contracts"

/** The seats that may cancel a run: the people who govern the workspace's agents. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * The owner door to stop a run that is queued, running or waiting: no further step runs, the run is marked cancelled with the member and the
 * moment, and any wait or timer it held is released. It never undoes what steps already sent or did. A run of another workspace answers as one
 * that does not exist, so no id is confirmed.
 */
export class AgentRunCancelService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly runs: AgentRunStoreService,
    ) {}

    /** Cancels the run for an owner or manager of its workspace; refused for any other seat. */
    async cancel(request: OwnerCancelRequest): Promise<OwnerCancelAnswer> {
        await this.members.require(request.principalId, request.workspaceId, GOVERNORS)
        const actor = await this.members.idOf(request.principalId, request.workspaceId)
        const run = await this.runs.runById(request.workspaceId, request.runId)
        if (run?.workspaceId !== request.workspaceId) return { kind: "not_found", note: null }
        const result = await this.runs.cancel(request.workspaceId, run.id, actor)
        return { kind: result.kind, note: result.kind === "cancelled" ? "effects_kept" : null }
    }
}
