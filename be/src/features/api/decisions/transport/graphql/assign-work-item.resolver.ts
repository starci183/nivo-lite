import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { AssignWorkItemCommand } from "../../application/assign-work-item.command"
import { AssignWorkItemInput } from "./dto/assign-work-item.input"
import { WorkItemType } from "./dto/work-item.type"
import { toAssignWorkItemRequest, toWorkItemType } from "./decisions.mapper"

@Resolver()
/** GraphQL door that gives a work item to a staff member. */
export class AssignWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Gives the item to a staff member, or takes the assignment back when staff is absent. */
    @Mutation(() => WorkItemType, { name: "assignWorkItem" })
    async assignWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: AssignWorkItemInput,
    ): Promise<WorkItemType> {
        const result = await this.commandBus.execute(
            new AssignWorkItemCommand({ request: toAssignWorkItemRequest(workspaceId, input, locale), principal }),
        )
        return toWorkItemType(result)
    }
}
