import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { EmptyRequest } from "./auth.contracts"

/** Signs the caller out of every other device. */
export class LogoutOthersCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<EmptyRequest>) {
        super()
    }
}
