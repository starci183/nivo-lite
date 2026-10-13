import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TransitionContentItemCommand } from "../../application/transition-content-item.command"
import { toTransitionContentItemRequest, toTransitionContentItemType } from "./transition-content-item.mapper"
import { TransitionContentItemInput } from "./dto/transition-content-item.input"
import { ContentItemIdType } from "./dto/content-item-id.type"

@Resolver()
/** GraphQL door for an authorized content editor operation. */
export class TransitionContentItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}
    /** transitionContentItem in the active workspace. */
    @Mutation(() => ContentItemIdType, { name: "transitionContentItem" })
    async transitionContentItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TransitionContentItemInput,
    ): Promise<ContentItemIdType> {
        const result = await this.commandBus.execute(
            new TransitionContentItemCommand({
                request: toTransitionContentItemRequest(workspaceId, input),
                principal,
            }),
        )
        return toTransitionContentItemType(result)
    }
}
