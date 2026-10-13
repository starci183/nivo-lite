import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AddSourceCommand } from "./add-source.command"

@CommandHandler(AddSourceCommand)
/** Adds the document through the sources service. */
export class AddSourceHandler extends ICQRSHandler<AddSourceCommand, SourceRef> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: AddSourceCommand): Promise<SourceRef> {
        return this.sources.addSource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
