import { CommandHandler } from "@nestjs/cqrs"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AcceptMetaDeliveryCommand } from "./accept-meta-delivery.command"
import type { AcceptMetaDeliveryResult } from "./accept-meta-delivery.contracts"

@CommandHandler(AcceptMetaDeliveryCommand)
/** Records one signed Meta delivery through the inbox. */
export class AcceptMetaDeliveryHandler extends ICQRSHandler<AcceptMetaDeliveryCommand, AcceptMetaDeliveryResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaInboxService: MetaInboxService,
    ) {
        super(logger)
    }

    protected override process(command: AcceptMetaDeliveryCommand): Promise<AcceptMetaDeliveryResult> {
        const { rawBody, signature } = command.params.request
        return this.metaInboxService.accept(rawBody, signature)
    }
}
