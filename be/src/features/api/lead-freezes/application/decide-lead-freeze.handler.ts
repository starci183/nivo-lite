import { CommandHandler } from "@nestjs/cqrs"
import { LeadFreezeDoorService } from "@modules/domain/lead-freezes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideLeadFreezeCommand } from "./decide-lead-freeze.command"
import type { DecideLeadFreezeOutcome } from "./lead-freeze.contracts"

@CommandHandler(DecideLeadFreezeCommand)
/** PHASE 3 SHELL: the pages' answer to a held customer; a hold is answered on its stop, so this only says `on_stop` or `not_found`. */
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
