import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveContentItemCommand } from "../../application/save-content-item.command"
import { toSaveContentItemRequest, toSaveContentItemType } from "./save-content-item.mapper"
import { SaveContentItemInput } from "./dto/save-content-item.input"
import { ContentItemType } from "./dto/content-item.type"

@Resolver()
/** GraphQL door for an authorized content editor operation. */
export class SaveContentItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}
    /** saveContentItem in the active workspace. */
    @Mutation(() => ContentItemType, { name: "saveContentItem" })
    async saveContentItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveContentItemInput,
    ): Promise<ContentItemType> {
        const result = await this.commandBus.execute(
            new SaveContentItemCommand({ request: toSaveContentItemRequest(workspaceId, input), principal }),
        )
        return toSaveContentItemType(result)
    }
}
