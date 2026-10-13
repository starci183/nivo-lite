import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInventoryItemCommand } from "../../application/save-inventory-item.command"
import { InventoryRefType } from "./dto/inventory-ref.type"
import { SaveInventoryItemInput } from "./dto/save-inventory-item.input"
import { toSaveInventoryItemRequest, toInventoryRefType } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: create or update one catalogue item. */
export class SaveInventoryItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one catalogue item. */
    @Mutation(() => InventoryRefType, { name: "saveInventoryItem" })
    async saveInventoryItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveInventoryItemInput,
    ): Promise<InventoryRefType> {
        const result = await this.commandBus.execute(
            new SaveInventoryItemCommand({ request: toSaveInventoryItemRequest(workspaceId, input), principal }),
        )
        return toInventoryRefType(result)
    }
}
