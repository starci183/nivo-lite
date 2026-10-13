import { Command } from "@nestjs/cqrs"
import type { ConfirmResult } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConfirmCommandRequest } from "./confirm-command.contracts"

/** Asks to send a pending command card through the command bus as the owner. */
export class ConfirmCommandCommand extends Command<ConfirmResult> {
    constructor(readonly params: ExecuteParams<ConfirmCommandRequest>) {
        super()
    }
}
