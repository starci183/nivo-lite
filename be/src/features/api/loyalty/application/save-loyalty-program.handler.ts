import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltySetupService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LoyaltyProgram } from "./save-loyalty-program.contracts"
import { SaveLoyaltyProgramCommand } from "./save-loyalty-program.command"

@CommandHandler(SaveLoyaltyProgramCommand)
/** Delegates save loyalty program to the loyalty capability. */
export class SaveLoyaltyProgramHandler extends ICQRSHandler<SaveLoyaltyProgramCommand, LoyaltyProgram> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltySetupService,
    ) {
        super(logger)
    }

    protected override process(action: SaveLoyaltyProgramCommand): Promise<LoyaltyProgram> {
        return this.service.saveProgram(action.params.principal.id, action.params.request)
    }
}
