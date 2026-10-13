import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RecordOutcomeRequest, RecordOutcomeResult } from "./record-outcome.contracts"

/** Asks to record the outcome of the journey of a lead in the workspace of the caller. */
export class RecordOutcomeCommand extends Command<RecordOutcomeResult> {
    constructor(readonly params: ExecuteParams<RecordOutcomeRequest>) {
        super()
    }
}
