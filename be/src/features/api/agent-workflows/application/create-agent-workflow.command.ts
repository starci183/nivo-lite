import { Command } from "@nestjs/cqrs"
import type { WorkflowWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateAgentWorkflowRequest } from "./create-agent-workflow.contracts"

/** Adds a workflow to the agent: a copy of a template version, or a blank one with a name. */
export class CreateAgentWorkflowCommand extends Command<WorkflowWire> {
    constructor(readonly params: ExecuteParams<CreateAgentWorkflowRequest>) {
        super()
    }
}
