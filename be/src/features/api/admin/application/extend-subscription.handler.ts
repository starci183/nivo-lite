import { CommandHandler } from "@nestjs/cqrs"
import { AdminSupportService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ExtendSubscriptionResult } from "./extend-subscription.contracts"
import { ExtendSubscriptionCommand } from "./extend-subscription.command"

@CommandHandler(ExtendSubscriptionCommand)
/** Extends a workspace's subscription by a number of days. */
export class ExtendSubscriptionHandler extends ICQRSHandler<ExtendSubscriptionCommand, ExtendSubscriptionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminSupportService: AdminSupportService,
    ) {
        super(logger)
    }

    protected override process(command: ExtendSubscriptionCommand): Promise<ExtendSubscriptionResult> {
        return this.adminSupportService.extendSubscription(
            command.params.principal,
            command.params.request.workspaceId,
            command.params.request.days,
        )
    }
}
