import { QueryHandler } from "@nestjs/cqrs"
import { AuthorityGrantsService } from "@modules/domain/decisions"
import type { DirectoryMember } from "@modules/domain/member-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListApproversQuery } from "./list-approvers.query"

@QueryHandler(ListApproversQuery)
/** Answers the people an approver group can name from the decisions service. */
export class ListApproversHandler extends ICQRSHandler<ListApproversQuery, ReadonlyArray<DirectoryMember>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: AuthorityGrantsService,
    ) {
        super(logger)
    }

    protected override process(query: ListApproversQuery): Promise<ReadonlyArray<DirectoryMember>> {
        return this.grants.listApprovers(query.params.principal.id, query.params.request.workspaceId)
    }
}
