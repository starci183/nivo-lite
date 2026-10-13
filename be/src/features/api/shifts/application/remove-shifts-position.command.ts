import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveShiftsPositionRequest } from "./remove-shifts-position.contracts"

/** Asks for retire a position. */
export class RemoveShiftsPositionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveShiftsPositionRequest>) {
        super()
    }
}
