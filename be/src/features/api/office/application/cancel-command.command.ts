import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelCommandRequest } from "./cancel-command.contracts"

/** Asks to cancel a pending command card; nothing is sent. */
export class CancelCommandCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CancelCommandRequest>) {
        super()
    }
}
