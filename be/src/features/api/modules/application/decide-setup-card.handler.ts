import { CommandHandler } from "@nestjs/cqrs"
import { SetupCardsService } from "@modules/domain/modules"
import type { CardRecord } from "@modules/domain/module-setup-writes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideSetupCardCommand } from "./decide-setup-card.command"

@CommandHandler(DecideSetupCardCommand)
/** Decides the card through the setup cards service. */
export class DecideSetupCardHandler extends ICQRSHandler<DecideSetupCardCommand, CardRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly cards: SetupCardsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideSetupCardCommand): Promise<CardRecord> {
        return this.cards.decide(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.cardId,
            command.params.request.change,
            command.params.request.locale,
        )
    }
}
