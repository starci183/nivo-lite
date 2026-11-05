import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { StartZaloInboxPollRequest } from "./start-zalo-inbox-poll.contracts"

/** Asks to start the first poll of the connection one delivered connection_ready event names. */
export class StartZaloInboxPollCommand extends Command<boolean> {
    constructor(readonly params: PublicExecuteParams<StartZaloInboxPollRequest>) {
        super()
    }
}
