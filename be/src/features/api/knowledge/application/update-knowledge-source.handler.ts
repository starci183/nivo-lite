import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateKnowledgeSourceCommand } from "./update-knowledge-source.command"

@CommandHandler(UpdateKnowledgeSourceCommand)
/** Changes the metadata of a document without reading it again. */
export class UpdateKnowledgeSourceHandler extends ICQRSHandler<UpdateKnowledgeSourceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateKnowledgeSourceCommand): Promise<void> {
        return this.sources.updateSource(command.params.principal.id, command.params.request.workspaceId, command.params.request)
    }
}
