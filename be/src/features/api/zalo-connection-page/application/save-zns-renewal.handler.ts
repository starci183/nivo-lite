import { CommandHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import type { OptionalZnsRenewal } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveZnsRenewalCommand } from "./save-zns-renewal.command"

@CommandHandler(SaveZnsRenewalCommand)
/** Stores the ZNS renewal template of a Zalo connection through the ZaloConnectService (owner only). */
export class SaveZnsRenewalHandler extends ICQRSHandler<SaveZnsRenewalCommand, OptionalZnsRenewal> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(command: SaveZnsRenewalCommand): Promise<OptionalZnsRenewal> {
        return this.zalo.saveZnsRenewal(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.settings,
        )
    }
}
