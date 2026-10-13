import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateSourceCommand } from "./update-source.command"

@CommandHandler(UpdateSourceCommand)
/** Changes the document through the sources service. */
export class UpdateSourceHandler extends ICQRSHandler<UpdateSourceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateSourceCommand): Promise<void> {
        return this.sources.updateSource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
