import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeReembedService } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestReembedCommand } from "./request-reembed.command"

@CommandHandler(RequestReembedCommand)
/** Queues the re-embedding through the re-embed service. */
export class RequestReembedHandler extends ICQRSHandler<RequestReembedCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reembedding: KnowledgeReembedService,
    ) {
        super(logger)
    }

    protected override process(command: RequestReembedCommand): Promise<void> {
        return this.reembedding.request(command.params.principal.id, command.params.request.workspaceId)
    }
}
