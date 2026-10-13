import { Command } from "@nestjs/cqrs"
import type { CommandResult } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SendCommandRequest } from "./send-command.contracts"

/** Asks to send a command to an agent as the owner. */
export class SendCommandCommand extends Command<CommandResult> {
    constructor(readonly params: ExecuteParams<SendCommandRequest>) {
        super()
    }
}
