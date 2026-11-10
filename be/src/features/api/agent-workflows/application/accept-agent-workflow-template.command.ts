import { Command } from "@nestjs/cqrs"
import type { WorkflowVersionWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AcceptAgentWorkflowTemplateRequest } from "./accept-agent-workflow-template.contracts"

/** Accepts a newer template version into a workflow, written as a new version. */
export class AcceptAgentWorkflowTemplateCommand extends Command<WorkflowVersionWire> {
    constructor(readonly params: ExecuteParams<AcceptAgentWorkflowTemplateRequest>) {
        super()
    }
}
