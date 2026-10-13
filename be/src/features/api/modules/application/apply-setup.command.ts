import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplySetupRequest } from "./apply-setup.contracts"

/** Asks to apply the open draft as the next context version. */
export class ApplySetupCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<ApplySetupRequest>) {
        super()
    }
}
