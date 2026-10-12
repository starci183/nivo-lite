import { QueryHandler } from "@nestjs/cqrs"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMembershipsQuery } from "./list-memberships.query"

@QueryHandler(ListMembershipsQuery)
/** Answers the caller's memberships from the workspaces service. */
export class ListMembershipsHandler extends ICQRSHandler<ListMembershipsQuery, ReadonlyArray<WorkspaceMembership>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workspaces: WorkspacesService,
    ) {
        super(logger)
    }

    protected override process(query: ListMembershipsQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
        return this.workspaces.memberships(query.params.principal.id)
    }
}
