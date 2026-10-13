import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReindexKnowledgeSourceCommand } from "./reindex-knowledge-source.command"

@CommandHandler(ReindexKnowledgeSourceCommand)
/** Reads a document again, optionally with new text. */
export class ReindexKnowledgeSourceHandler extends ICQRSHandler<ReindexKnowledgeSourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: ReindexKnowledgeSourceCommand): Promise<SourceRef> {
        return this.sources.reindexSource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
