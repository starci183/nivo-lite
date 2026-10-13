import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { HoldWorkItemCommand } from "../../application/hold-work-item.command"
import { HoldWorkItemArgs } from "./dto/hold-work-item.args"
import { WorkItemType } from "./dto/work-item.type"
import { toHeldWorkItemType, toHoldWorkItemRequest } from "./hold-work-item.mapper"

@Resolver()
/** GraphQL door that keeps a waiting work item waiting. */
export class HoldWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records a note on a waiting item without deciding it. */
    @Mutation(() => WorkItemType, { name: "holdWorkItem" })
    async holdWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args() args: HoldWorkItemArgs,
    ): Promise<WorkItemType> {
        const result = await this.commandBus.execute(
            new HoldWorkItemCommand({ request: toHoldWorkItemRequest(workspaceId, args), principal }),
        )
        return toHeldWorkItemType(result)
    }
}
