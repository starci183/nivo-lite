import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RetryKnowledgeSourceCommand } from "./retry-knowledge-source.command"

@CommandHandler(RetryKnowledgeSourceCommand)
/** Puts a failed or credit-blocked document back on the queue. */
export class RetryKnowledgeSourceHandler extends ICQRSHandler<RetryKnowledgeSourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: RetryKnowledgeSourceCommand): Promise<SourceRef> {
        return this.sources.retrySource(command.params.principal.id, command.params.request.workspaceId, command.params.request.id)
    }
}
