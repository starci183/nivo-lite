import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateContentItemCommand } from "../../application/create-content-item.command"
import { toCreateContentItemRequest, toCreateContentItemType } from "./create-content-item.mapper"
import { CreateContentItemInput } from "./dto/create-content-item.input"
import { ContentItemType } from "./dto/content-item.type"

@Resolver()
/** GraphQL door for an authorized content editor operation. */
export class CreateContentItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}
    /** createContentItem in the active workspace. */
    @Mutation(() => ContentItemType, { name: "createContentItem" })
    async createContentItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateContentItemInput,
    ): Promise<ContentItemType> {
        const result = await this.commandBus.execute(
            new CreateContentItemCommand({ request: toCreateContentItemRequest(workspaceId, input), principal }),
        )
        return toCreateContentItemType(result)
    }
}
