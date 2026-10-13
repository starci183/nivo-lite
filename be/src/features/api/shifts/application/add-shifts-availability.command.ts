import { Command } from "@nestjs/cqrs"
import type { SaveShiftsAvailabilityOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddShiftsAvailabilityRequest } from "./add-shifts-availability.contracts"

/** Asks for add an availability statement for a person, approved at once. */
export class AddShiftsAvailabilityCommand extends Command<SaveShiftsAvailabilityOutput> {
    constructor(readonly params: ExecuteParams<AddShiftsAvailabilityRequest>) {
        super()
    }
}
