import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { FlowResult } from "@modules/domain/flows"
import type { RunFlowRequest } from "./run-flow.contracts"

/** Runs one operating-flow command as the signed-in member. */
export class RunFlowCommand extends Command<FlowResult> {
    constructor(readonly params: ExecuteParams<RunFlowRequest>) {
        super()
    }
}
