import { CommandHandler } from "@nestjs/cqrs"
import { BrainChangeMessagesService, BrainService } from "@modules/domain/brain"
import type { FactRecord } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideBrainFactCommand } from "./decide-brain-fact.command"

@CommandHandler(DecideBrainFactCommand)
/** Applies, rejects, chooses, splits or retires a fact. */
export class DecideBrainFactHandler extends ICQRSHandler<DecideBrainFactCommand, FactRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
        private readonly changes: BrainChangeMessagesService,
    ) {
        super(logger)
    }

    protected override async process(command: DecideBrainFactCommand): Promise<FactRecord> {
        const fact = await this.brain.decideFact(command.params.principal.id, command.params.request)
        // A decision taken on the Second Brain page keeps the open `brain.change` card of that request in line (applied / rejected).
        await this.changes.follow(command.params.request.workspaceId, fact)
        return fact
    }
}
