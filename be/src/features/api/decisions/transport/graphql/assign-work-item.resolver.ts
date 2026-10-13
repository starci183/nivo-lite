import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AssignWorkItemCommand } from "../../application/assign-work-item.command"
import { toAssignedWorkItemType, toAssignWorkItemRequest } from "./assign-work-item.mapper"
import { AssignWorkItemArgs } from "./dto/assign-work-item.args"
import { WorkItemType } from "./dto/work-item.type"

@Resolver()
/** GraphQL door that gives a work item to a staff member. */
export class AssignWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Gives an exception to a staff member, or takes it back when `staffId` is absent. */
    @Mutation(() => WorkItemType, { name: "assignWorkItem" })
    async assignWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args() args: AssignWorkItemArgs,
    ): Promise<WorkItemType> {
        const result = await this.commandBus.execute(
            new AssignWorkItemCommand({ request: toAssignWorkItemRequest(workspaceId, args), principal }),
        )
        return toAssignedWorkItemType(result)
    }
}
