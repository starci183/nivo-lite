import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInventorySupplierCommand } from "../../application/save-inventory-supplier.command"
import { InventoryRefType } from "./dto/inventory-ref.type"
import { SaveInventorySupplierInput } from "./dto/save-inventory-supplier.input"
import { toSaveInventorySupplierRequest, toInventoryRefType } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: create or update one supplier. */
export class SaveInventorySupplierResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one supplier. */
    @Mutation(() => InventoryRefType, { name: "saveInventorySupplier" })
    async saveInventorySupplier(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveInventorySupplierInput,
    ): Promise<InventoryRefType> {
        const result = await this.commandBus.execute(
            new SaveInventorySupplierCommand({
                request: toSaveInventorySupplierRequest(workspaceId, input),
                principal,
            }),
        )
        return toInventoryRefType(result)
    }
}
