import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteInventoryRecipeCommand } from "../../application/delete-inventory-recipe.command"
import { InventoryRecipeRefInput } from "./dto/inventory-recipe-ref.input"
import { toDeleteInventoryRecipeRequest } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: delete one recipe. */
export class DeleteInventoryRecipeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delete one recipe. */
    @Mutation(() => Boolean, { name: "deleteInventoryRecipe" })
    async deleteInventoryRecipe(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InventoryRecipeRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DeleteInventoryRecipeCommand({
                request: toDeleteInventoryRecipeRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
