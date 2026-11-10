import { Command } from "@nestjs/cqrs"
import type { StopDoorAnswer } from "@modules/domain/agent-threads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideRunStopRequest } from "./decide-run-stop.contracts"

/** Hands a person's decision (their words, or a button of the card) to the stop of a thread run. */
export class DecideRunStopCommand extends Command<StopDoorAnswer> {
    constructor(readonly params: ExecuteParams<DecideRunStopRequest>) {
        super()
    }
}
