import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveProgramParams, LoyaltyProgram } from "./save-loyalty-program.contracts"

/** Requests save loyalty program for the current principal. */
export class SaveLoyaltyProgramCommand extends Command<LoyaltyProgram> {
    constructor(readonly params: ExecuteParams<SaveProgramParams>) {
        super()
    }
}
