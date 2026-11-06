import { CommandHandler } from "@nestjs/cqrs"
import { AuthorityGrantsService } from "@modules/domain/decisions"
import type { MemberGrant } from "@modules/domain/member-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveMemberGrantsCommand } from "./save-member-grants.command"

@CommandHandler(SaveMemberGrantsCommand)
/** Saves the approval limits of one action through the decisions service. */
export class SaveMemberGrantsHandler extends ICQRSHandler<SaveMemberGrantsCommand, ReadonlyArray<MemberGrant>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: AuthorityGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveMemberGrantsCommand): Promise<ReadonlyArray<MemberGrant>> {
        return this.grants.saveMemberGrants(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.action,
            command.params.request.grants,
        )
    }
}
