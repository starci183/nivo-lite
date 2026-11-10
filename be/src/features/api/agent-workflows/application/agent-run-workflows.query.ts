import { Query } from "@nestjs/cqrs"
import type { RunPinView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentRunWorkflowsRequest } from "./agent-run-workflows.contracts"

/** Reads the workflow and version each of these runs of the installation's agent executes. */
export class AgentRunWorkflowsQuery extends Query<ReadonlyArray<RunPinView>> {
    constructor(readonly params: ExecuteParams<AgentRunWorkflowsRequest>) {
        super()
    }
}
