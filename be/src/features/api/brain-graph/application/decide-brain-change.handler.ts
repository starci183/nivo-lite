import { CommandHandler } from "@nestjs/cqrs"
import { BrainChangeMessagesService } from "@modules/domain/brain/brain-change-messages.service"
import type { BrainChangeDecision } from "@modules/domain/brain/brain-change-messages.service"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideBrainChangeCommand } from "./decide-brain-change.command"

@CommandHandler(DecideBrainChangeCommand)
/** Decides a truth-graph change card: Đồng ý (the founder) or Không; the card is rewritten in place. */
export class DecideBrainChangeHandler extends ICQRSHandler<DecideBrainChangeCommand, BrainChangeDecision> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly changes: BrainChangeMessagesService,
    ) {
        super(logger)
    }

    protected override process(command: DecideBrainChangeCommand): Promise<BrainChangeDecision> {
        return this.changes.decide(command.params.principal.id, command.params.request)
    }
}
