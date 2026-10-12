import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { MemberListing } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMembersQuery } from "./list-members.query"

@QueryHandler(ListMembersQuery)
/** Answers the workspace's members from the members service. */
export class ListMembersHandler extends ICQRSHandler<ListMembersQuery, ReadonlyArray<MemberListing>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(query: ListMembersQuery): Promise<ReadonlyArray<MemberListing>> {
        return this.members.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
