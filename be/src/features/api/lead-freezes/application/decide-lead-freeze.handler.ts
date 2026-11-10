import { CommandHandler } from "@nestjs/cqrs"
import { LeadFreezeDoorService } from "@modules/domain/lead-freezes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideLeadFreezeCommand } from "./decide-lead-freeze.command"
import type { DecideLeadFreezeOutcome } from "./lead-freeze.contracts"

@CommandHandler(DecideLeadFreezeCommand)
/** The owner's answer to a frozen customer, from the lead page or the run page: retry, take over, or skip the turn. */
export class DecideLeadFreezeHandler extends ICQRSHandler<DecideLeadFreezeCommand, DecideLeadFreezeOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: LeadFreezeDoorService,
    ) {
        super(logger)
    }

    protected override process(command: DecideLeadFreezeCommand): Promise<DecideLeadFreezeOutcome> {
        return this.door.answer(command.params.principal.id, command.params.request)
    }
}
