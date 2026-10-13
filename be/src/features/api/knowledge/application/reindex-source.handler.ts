import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReindexSourceCommand } from "./reindex-source.command"

@CommandHandler(ReindexSourceCommand)
/** Reads the document again through the sources service. */
export class ReindexSourceHandler extends ICQRSHandler<ReindexSourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: ReindexSourceCommand): Promise<SourceRef> {
        return this.sources.reindexSource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
