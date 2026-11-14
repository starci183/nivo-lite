import { Command } from "@nestjs/cqrs"
import type { RunFlowResult } from "@modules/domain/agent-pages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunFlowRequest } from "./run-flow.contracts"

/** Decides the work item a thread approval wrote, by its id, as the signed-in member. */
export class RunFlowCommand extends Command<RunFlowResult> {
    constructor(readonly params: ExecuteParams<RunFlowRequest>) {
        super()
    }
}
