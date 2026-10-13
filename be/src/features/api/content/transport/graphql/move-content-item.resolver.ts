import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MoveContentItemCommand } from "../../application/move-content-item.command"
import { toMoveContentItemRequest, toMoveContentItemType } from "./move-content-item.mapper"
import { MoveContentItemInput } from "./dto/move-content-item.input"
import { ContentItemType } from "./dto/content-item.type"

@Resolver()
/** GraphQL door for an authorized content editor operation. */
export class MoveContentItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}
    /** moveContentItem in the active workspace. */
    @Mutation(() => ContentItemType, { name: "moveContentItem" })
    async moveContentItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MoveContentItemInput,
    ): Promise<ContentItemType> {
        const result = await this.commandBus.execute(
            new MoveContentItemCommand({ request: toMoveContentItemRequest(workspaceId, input), principal }),
        )
        return toMoveContentItemType(result)
    }
}
