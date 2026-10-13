import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RetrySourceCommand } from "./retry-source.command"

@CommandHandler(RetrySourceCommand)
/** Retries the document through the sources service. */
export class RetrySourceHandler extends ICQRSHandler<RetrySourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: RetrySourceCommand): Promise<SourceRef> {
        return this.sources.retrySource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.sourceId,
        )
    }
}
