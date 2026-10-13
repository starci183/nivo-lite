import { Command } from "@nestjs/cqrs"
import type { SaveShiftsAvailabilityOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SubmitShiftsAvailabilityRequest } from "./submit-shifts-availability.contracts"

/** Asks for file the caller's own availability statement, waiting for approval. */
export class SubmitShiftsAvailabilityCommand extends Command<SaveShiftsAvailabilityOutput> {
    constructor(readonly params: ExecuteParams<SubmitShiftsAvailabilityRequest>) {
        super()
    }
}
