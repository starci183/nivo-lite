import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChangePasswordRequest } from "./auth.contracts"

/** Changes the password of the signed-in person after proving the current one. */
export class ChangePasswordCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChangePasswordRequest>) {
        super()
    }
}
