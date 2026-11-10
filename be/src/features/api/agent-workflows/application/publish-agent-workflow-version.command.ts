import { Command } from "@nestjs/cqrs"
import type { WorkflowVersionWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PublishAgentWorkflowVersionRequest } from "./publish-agent-workflow-version.contracts"

/** Publishes a graph as the next version of a workflow. */
export class PublishAgentWorkflowVersionCommand extends Command<WorkflowVersionWire> {
    constructor(readonly params: ExecuteParams<PublishAgentWorkflowVersionRequest>) {
        super()
    }
}
