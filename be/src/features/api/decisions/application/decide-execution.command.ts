import { Command } from "@nestjs/cqrs"
import type { ExecutionRow } from "@modules/domain/executions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideExecutionRequest } from "./decide-execution.contracts"

/** Asks to approve (optionally with an edited draft) or reject an approval card. */
export class DecideExecutionCommand extends Command<ExecutionRow> {
    constructor(readonly params: ExecuteParams<DecideExecutionRequest>) {
        super()
    }
}
