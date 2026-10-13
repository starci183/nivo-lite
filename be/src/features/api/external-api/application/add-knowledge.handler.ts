import { CommandHandler } from "@nestjs/cqrs"
import { PublicKnowledgeService } from "@modules/domain/public-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AddKnowledgeResult } from "./add-knowledge.contracts"
import { AddKnowledgeCommand } from "./add-knowledge.command"

@CommandHandler(AddKnowledgeCommand)
/** Adds a knowledge source through one domain-service call that admits the key first; indexing is a job. */
export class AddKnowledgeHandler extends ICQRSHandler<AddKnowledgeCommand, AddKnowledgeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly knowledge: PublicKnowledgeService,
    ) {
        super(logger)
    }

    protected override process(command: AddKnowledgeCommand): Promise<AddKnowledgeResult> {
        return this.knowledge.acceptKnowledge(command.params.request)
    }
}
