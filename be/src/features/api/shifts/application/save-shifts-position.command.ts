import { Command } from "@nestjs/cqrs"
import type { SavePositionOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveShiftsPositionRequest } from "./save-shifts-position.contracts"

/** Asks for create or update one position. */
export class SaveShiftsPositionCommand extends Command<SavePositionOutput> {
    constructor(readonly params: ExecuteParams<SaveShiftsPositionRequest>) {
        super()
    }
}
