import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService, type StaffOption } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListStaffQuery } from "./list-staff.query"

@QueryHandler(ListStaffQuery)
/** Answers the linkable staff rows from the members service. */
export class ListStaffHandler extends ICQRSHandler<ListStaffQuery, ReadonlyArray<StaffOption>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(query: ListStaffQuery): Promise<ReadonlyArray<StaffOption>> {
        return this.members.listStaff(query.params.principal.id, query.params.request.workspaceId)
    }
}
