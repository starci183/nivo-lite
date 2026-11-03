import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { StartBankFeedPollRequest } from "./start-bank-feed-poll.contracts"

/** Asks to start the first poll of the connection one delivered connection_ready event names. */
export class StartBankFeedPollCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<StartBankFeedPollRequest>) {
        super()
    }
}
