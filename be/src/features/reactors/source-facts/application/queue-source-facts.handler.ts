import { CommandHandler } from "@nestjs/cqrs"
import { IndexedSourcesService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueSourceFactsCommand } from "./queue-source-facts.command"

@CommandHandler(QueueSourceFactsCommand)
/** Hands the delivered knowledge_source_indexed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class QueueSourceFactsHandler extends ICQRSHandler<QueueSourceFactsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly indexed: IndexedSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: QueueSourceFactsCommand): Promise<void> {
        return this.indexed.queueFacts(command.params.request.delivery.event.payload, {
            consumer: command.params.request.delivery.consumer,
            dedupeKey: command.params.request.delivery.dedupeKey,
        })
    }
}
