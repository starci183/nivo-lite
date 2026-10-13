import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyMembersService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetMemberDetailResult } from "./get-member-detail.contracts"
import { GetMemberDetailQuery } from "./get-member-detail.query"

@QueryHandler(GetMemberDetailQuery)
/** Runs get-member-detail through one call of the LoyaltyMembersService. */
export class GetMemberDetailHandler extends ICQRSHandler<GetMemberDetailQuery, GetMemberDetailResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: LoyaltyMembersService,
    ) {
        super(logger)
    }

    protected override process(command: GetMemberDetailQuery): Promise<GetMemberDetailResult> {
        return this.members.detail(command.params.principal.id, command.params.request)
    }
}
