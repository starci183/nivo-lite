import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateProfileRequest } from "./update-profile.contracts"

/** Asks to rename the caller in every workspace they actively belong to. */
export class UpdateProfileCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<UpdateProfileRequest>) {
        super()
    }
}
