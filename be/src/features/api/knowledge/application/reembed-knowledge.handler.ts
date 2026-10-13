import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeReembedService } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReembedKnowledgeCommand } from "./reembed-knowledge.command"

@CommandHandler(ReembedKnowledgeCommand)
/** Queues the re-embedding of the passages of the workspace made by another model. */
export class ReembedKnowledgeHandler extends ICQRSHandler<ReembedKnowledgeCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reembed: KnowledgeReembedService,
    ) {
        super(logger)
    }

    protected override process(command: ReembedKnowledgeCommand): Promise<void> {
        return this.reembed.request(command.params.principal.id, command.params.request.workspaceId)
    }
}
