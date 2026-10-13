import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInventoryRecipeCommand } from "../../application/save-inventory-recipe.command"
import { InventoryRefType } from "./dto/inventory-ref.type"
import { SaveInventoryRecipeInput } from "./dto/save-inventory-recipe.input"
import { toSaveInventoryRecipeRequest, toInventoryRefType } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: create or update one recipe. */
export class SaveInventoryRecipeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one recipe. */
    @Mutation(() => InventoryRefType, { name: "saveInventoryRecipe" })
    async saveInventoryRecipe(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveInventoryRecipeInput,
    ): Promise<InventoryRefType> {
        const result = await this.commandBus.execute(
            new SaveInventoryRecipeCommand({ request: toSaveInventoryRecipeRequest(workspaceId, input), principal }),
        )
        return toInventoryRefType(result)
    }
}
