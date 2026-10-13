import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DismissKnowledgeGapCommand } from "./dismiss-knowledge-gap.command"

@CommandHandler(DismissKnowledgeGapCommand)
/** Marks a customer question as not needing an answer. */
export class DismissKnowledgeGapHandler extends ICQRSHandler<DismissKnowledgeGapCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DismissKnowledgeGapCommand): Promise<void> {
        return this.brain.dismissGap(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
        )
    }
}
