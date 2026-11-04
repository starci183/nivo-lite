import { CommandHandler } from "@nestjs/cqrs"
import { BankFeedPollTriggerService } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartBankFeedPollCommand } from "./start-bank-feed-poll.command"

@CommandHandler(StartBankFeedPollCommand)
/** Hands the delivered connection_ready event to billing, which enqueues the one-connection poll when the provider can be read back. */
export class StartBankFeedPollHandler extends ICQRSHandler<StartBankFeedPollCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly trigger: BankFeedPollTriggerService,
    ) {
        super(logger)
    }

    protected override async process(command: StartBankFeedPollCommand): Promise<boolean> {
        return this.trigger.enqueueFirstPoll(command.params.request.delivery.event.payload)
    }
}
