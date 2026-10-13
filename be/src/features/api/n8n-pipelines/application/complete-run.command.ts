import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CompleteRunRequest, CompleteRunResult } from "./complete-run.contracts"

/** Closes the run with how it ended. */
export class CompleteRunCommand extends Command<CompleteRunResult> {
    constructor(readonly params: PublicExecuteParams<CompleteRunRequest>) {
        super()
    }
}
