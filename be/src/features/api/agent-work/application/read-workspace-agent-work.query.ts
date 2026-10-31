import { Query } from "@nestjs/cqrs"
import type { WorkspaceAgentWorkView } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadWorkspaceAgentWorkRequest } from "./read-workspace-agent-work.contracts"

/** Asks for the workspace-wide work switch with the counts beside it. */
export class ReadWorkspaceAgentWorkQuery extends Query<WorkspaceAgentWorkView> {
    constructor(readonly params: ExecuteParams<ReadWorkspaceAgentWorkRequest>) {
        super()
    }
}
