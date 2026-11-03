import { CommandHandler } from "@nestjs/cqrs"
import { ZaloInboxPollTriggerService } from "@modules/domain/zalo-provider"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartZaloInboxPollCommand } from "./start-zalo-inbox-poll.command"

@CommandHandler(StartZaloInboxPollCommand)
/** Hands the delivered connection_ready event to the Zalo inbox, which enqueues the one-connection poll when the provider can be read back. */
export class StartZaloInboxPollHandler extends ICQRSHandler<StartZaloInboxPollCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly trigger: ZaloInboxPollTriggerService,
    ) {
        super(logger)
    }

    protected override async process(command: StartZaloInboxPollCommand): Promise<void> {
        await this.trigger.enqueueFirstPoll(command.params.request.delivery.event.payload)
    }
}
