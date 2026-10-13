import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyMembersService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SyncMembersResult } from "./sync-members.contracts"
import { SyncMembersCommand } from "./sync-members.command"

@CommandHandler(SyncMembersCommand)
/** Runs sync-members through one call of the LoyaltyMembersService. */
export class SyncMembersHandler extends ICQRSHandler<SyncMembersCommand, SyncMembersResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: LoyaltyMembersService,
    ) {
        super(logger)
    }

    protected override process(command: SyncMembersCommand): Promise<SyncMembersResult> {
        return this.members.sync(command.params.principal.id, command.params.request)
    }
}
