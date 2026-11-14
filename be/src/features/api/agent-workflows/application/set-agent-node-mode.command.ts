import { Command } from "@nestjs/cqrs"
import type { WorkflowVersionWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentNodeModeRequest } from "./set-agent-node-mode.contracts"

/** Sets one node of a workflow to `auto` or `ask` (a new version of the workflow's graph copy). */
export class SetAgentNodeModeCommand extends Command<WorkflowVersionWire> {
    constructor(readonly params: ExecuteParams<SetAgentNodeModeRequest>) {
        super()
    }
}
