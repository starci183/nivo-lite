import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EnqueueKnowledgeSourceCommand } from "./enqueue-knowledge-source.command"

@CommandHandler(EnqueueKnowledgeSourceCommand)
/** Adds a document and queues its indexing. */
export class EnqueueKnowledgeSourceHandler extends ICQRSHandler<EnqueueKnowledgeSourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: EnqueueKnowledgeSourceCommand): Promise<SourceRef> {
        return this.sources.addSource(command.params.principal.id, command.params.request.workspaceId, command.params.request)
    }
}
