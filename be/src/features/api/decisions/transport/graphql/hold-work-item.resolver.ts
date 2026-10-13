import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { HoldWorkItemCommand } from "../../application/hold-work-item.command"
import { HoldWorkItemInput } from "./dto/hold-work-item.input"
import { WorkItemType } from "./dto/work-item.type"
import { toHoldWorkItemRequest, toWorkItemType } from "./decisions.mapper"

@Resolver()
/** GraphQL door that keeps a waiting work item waiting. */
export class HoldWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records a note and leaves the item waiting for a decision. */
    @Mutation(() => WorkItemType, { name: "holdWorkItem" })
    async holdWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: HoldWorkItemInput,
    ): Promise<WorkItemType> {
        const result = await this.commandBus.execute(
            new HoldWorkItemCommand({ request: toHoldWorkItemRequest(workspaceId, input, locale), principal }),
        )
        return toWorkItemType(result)
    }
}
