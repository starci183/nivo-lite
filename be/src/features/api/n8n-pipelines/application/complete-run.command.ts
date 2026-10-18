import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CompleteRunRequest } from "./complete-run.contracts"

/** Closes the run with how it ended. */
export class CompleteRunCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<CompleteRunRequest>) {
        super()
    }
}
