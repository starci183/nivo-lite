import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideWorkItemCommand } from "../../application/decide-work-item.command"
import { WorkItemType } from "./dto/work-item.type"
import { DecideWorkItemInput } from "./dto/decide-work-item.input"
import { toDecideWorkItemRequest, toWorkItemType } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the decision on a work item. */
export class DecideWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves (optionally edited) or rejects a waiting work item; a double click decides once. */
    @Mutation(() => WorkItemType, { name: "decideWorkItem" })
    async decideWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideWorkItemInput,
    ): Promise<WorkItemType> {
        const result = await this.commandBus.execute(
            new DecideWorkItemCommand({ request: toDecideWorkItemRequest(workspaceId, input, locale), principal }),
        )
        return toWorkItemType(result)
    }
}
