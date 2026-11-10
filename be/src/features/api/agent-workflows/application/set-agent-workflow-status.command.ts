import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentWorkflowStatusRequest } from "./set-agent-workflow-status.contracts"

/** Turns a workflow on (active), keeps it as a draft or pauses it. */
export class SetAgentWorkflowStatusCommand extends Command<boolean> {
    constructor(readonly params: ExecuteParams<SetAgentWorkflowStatusRequest>) {
        super()
    }
}
