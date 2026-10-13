import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyMembersService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AdjustPointsResult } from "./adjust-points.contracts"
import { AdjustPointsCommand } from "./adjust-points.command"

@CommandHandler(AdjustPointsCommand)
/** Runs adjust-points through one call of the LoyaltyMembersService. */
export class AdjustPointsHandler extends ICQRSHandler<AdjustPointsCommand, AdjustPointsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: LoyaltyMembersService,
    ) {
        super(logger)
    }

    protected override process(command: AdjustPointsCommand): Promise<AdjustPointsResult> {
        return this.members.adjust(command.params.principal.id, command.params.request)
    }
}
