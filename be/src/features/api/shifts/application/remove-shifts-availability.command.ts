import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveShiftsAvailabilityRequest } from "./remove-shifts-availability.contracts"

/** Asks for remove an availability statement. */
export class RemoveShiftsAvailabilityCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveShiftsAvailabilityRequest>) {
        super()
    }
}
