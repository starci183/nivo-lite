import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteKnowledgeSourceCommand } from "./delete-knowledge-source.command"

@CommandHandler(DeleteKnowledgeSourceCommand)
/** Deletes a document, then takes back what it contributed to the brain. */
export class DeleteKnowledgeSourceHandler extends ICQRSHandler<DeleteKnowledgeSourceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteKnowledgeSourceCommand): Promise<void> {
        return this.brain.removeSource(command.params.principal.id, command.params.request.workspaceId, command.params.request.id)
    }
}
