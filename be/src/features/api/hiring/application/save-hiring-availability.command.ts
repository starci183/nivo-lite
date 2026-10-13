import { Command } from "@nestjs/cqrs"
import type { SaveAvailabilityOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveHiringAvailabilityRequest } from "./save-hiring-availability.contracts"

/** Asks for replace the weekly free times of a member. */
export class SaveHiringAvailabilityCommand extends Command<SaveAvailabilityOutput> {
    constructor(readonly params: ExecuteParams<SaveHiringAvailabilityRequest>) {
        super()
    }
}
