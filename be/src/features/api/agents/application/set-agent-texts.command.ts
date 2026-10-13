import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentTextsRequest } from "./set-agent-texts.contracts"

/** Asks to replace the free texts of an agent. */
export class SetAgentTextsCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetAgentTextsRequest>) {
        super()
    }
}
