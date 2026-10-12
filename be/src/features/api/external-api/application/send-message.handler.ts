import { CommandHandler } from "@nestjs/cqrs"
import { PublicMessagesService } from "@modules/domain/public-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SendMessageResult } from "./send-message.contracts"
import { SendMessageCommand } from "./send-message.command"

@CommandHandler(SendMessageCommand)
/** Queues a message to a customer through one domain-service call that admits the key first. */
export class SendMessageHandler extends ICQRSHandler<SendMessageCommand, SendMessageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly messages: PublicMessagesService,
    ) {
        super(logger)
    }

    protected override process(command: SendMessageCommand): Promise<SendMessageResult> {
        return this.messages.acceptMessage(command.params.request)
    }
}
