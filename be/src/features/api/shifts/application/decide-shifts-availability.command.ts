import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideShiftsAvailabilityRequest } from "./decide-shifts-availability.contracts"

/** Asks for approve or decline a pending availability statement. */
export class DecideShiftsAvailabilityCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DecideShiftsAvailabilityRequest>) {
        super()
    }
}
