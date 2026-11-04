import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { StartBankFeedPollRequest } from "./start-bank-feed-poll.contracts"

/** Asks to start the first poll of the connection one delivered connection_ready event names; answers whether a poll was enqueued. */
export class StartBankFeedPollCommand extends Command<boolean> {
    constructor(readonly params: PublicExecuteParams<StartBankFeedPollRequest>) {
        super()
    }
}
