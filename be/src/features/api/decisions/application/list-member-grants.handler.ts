import { QueryHandler } from "@nestjs/cqrs"
import { AuthorityGrantsService } from "@modules/domain/decisions"
import type { MemberGrant } from "@modules/domain/member-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMemberGrantsQuery } from "./list-member-grants.query"

@QueryHandler(ListMemberGrantsQuery)
/** Answers the approval limits of one action from the decisions service. */
export class ListMemberGrantsHandler extends ICQRSHandler<ListMemberGrantsQuery, ReadonlyArray<MemberGrant>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: AuthorityGrantsService,
    ) {
        super(logger)
    }

    protected override process(query: ListMemberGrantsQuery): Promise<ReadonlyArray<MemberGrant>> {
        return this.grants.listMemberGrants(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.action,
        )
    }
}
