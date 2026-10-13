import { CommandHandler } from "@nestjs/cqrs"
import { CreditsService } from "@modules/domain/credits"
import type { UpgradeOrder } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpgradePlanCommand } from "./upgrade-plan.command"

@CommandHandler(UpgradePlanCommand)
/** Creates the upgrade order through the credits service, which admits owner and manager only. */
export class UpgradePlanHandler extends ICQRSHandler<UpgradePlanCommand, UpgradeOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(command: UpgradePlanCommand): Promise<UpgradeOrder> {
        return this.credits.upgrade(command.params.principal.id, command.params.request)
    }
}
