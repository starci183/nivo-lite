import { CommandHandler } from "@nestjs/cqrs"
import { DocumentAreaService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdateKnowledgeSourceCommand } from "./update-knowledge-source.command"

@CommandHandler(UpdateKnowledgeSourceCommand)
/** Changes the metadata of a document without reading it again; a change of area moves its passages and truths (`DocumentAreaService`). */
export class UpdateKnowledgeSourceHandler extends ICQRSHandler<UpdateKnowledgeSourceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly areas: DocumentAreaService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateKnowledgeSourceCommand): Promise<void> {
        return this.areas.update(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
