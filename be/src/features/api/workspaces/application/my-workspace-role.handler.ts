import { QueryHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { PresentedRole } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MyWorkspaceRoleQuery } from "./my-workspace-role.query"

@QueryHandler(MyWorkspaceRoleQuery)
/** Answers the caller's role from the members service. */
export class MyWorkspaceRoleHandler extends ICQRSHandler<MyWorkspaceRoleQuery, PresentedRole> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(query: MyWorkspaceRoleQuery): Promise<PresentedRole> {
        return this.members.roleOf(query.params.principal.id, query.params.request.workspaceId)
    }
}
