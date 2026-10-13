import { CommandHandler } from "@nestjs/cqrs"
import { N8nDoorService } from "@modules/domain/n8n-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { N8nEmailAnswer } from "@modules/domain/n8n-runs"
import { SendEmailCommand } from "./send-email.command"

@CommandHandler(SendEmailCommand)
/** Sends one email of the running workflow. */
export class SendEmailHandler extends ICQRSHandler<SendEmailCommand, N8nEmailAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: N8nDoorService,
    ) {
        super(logger)
    }

    protected override process(message: SendEmailCommand): Promise<N8nEmailAnswer> {
        return this.door.sendEmail(message.params.request.authorization, message.params.request.email)
    }
}
