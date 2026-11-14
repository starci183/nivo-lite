import { Command } from "@nestjs/cqrs"
import type { WorkflowStartAnswer } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunWorkflowRequest } from "./run-workflow.contracts"

/** Starts one workflow of an installed agent by hand, once per opKey. */
export class RunWorkflowCommand extends Command<WorkflowStartAnswer> {
    constructor(readonly params: ExecuteParams<RunWorkflowRequest>) {
        super()
    }
}
