import { Command } from "@nestjs/cqrs"
import type { WorkflowVersionWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RollbackAgentWorkflowRequest } from "./rollback-agent-workflow.contracts"

/** Rolls a workflow back to an older version, written as a new version. */
export class RollbackAgentWorkflowCommand extends Command<WorkflowVersionWire> {
    constructor(readonly params: ExecuteParams<RollbackAgentWorkflowRequest>) {
        super()
    }
}
