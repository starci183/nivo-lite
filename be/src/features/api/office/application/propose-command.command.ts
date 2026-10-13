import { Command } from "@nestjs/cqrs"
import type { ProposeOutcome } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ProposeCommandRequest } from "./propose-command.contracts"

/** Asks to read an owner message into a command card or a reply. */
export class ProposeCommandCommand extends Command<ProposeOutcome> {
    constructor(readonly params: ExecuteParams<ProposeCommandRequest>) {
        super()
    }
}
