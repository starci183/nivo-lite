import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltySetupService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CustomerUpdateResult } from "./update-loyalty-member.contracts"
import { UpdateLoyaltyMemberCommand } from "./update-loyalty-member.command"

@CommandHandler(UpdateLoyaltyMemberCommand)
/** Delegates update loyalty member to the loyalty capability. */
export class UpdateLoyaltyMemberHandler extends ICQRSHandler<UpdateLoyaltyMemberCommand, CustomerUpdateResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltySetupService,
    ) {
        super(logger)
    }

    protected override process(action: UpdateLoyaltyMemberCommand): Promise<CustomerUpdateResult> {
        return this.service.updateCustomer(action.params.principal.id, action.params.request)
    }
}
