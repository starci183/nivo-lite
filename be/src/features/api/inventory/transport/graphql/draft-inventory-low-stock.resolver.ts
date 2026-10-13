import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DraftInventoryLowStockCommand } from "../../application/draft-inventory-low-stock.command"
import { DraftLowStockType } from "./dto/draft-low-stock.type"
import { toDraftInventoryLowStockRequest, toDraftLowStockType } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: draft purchase orders for the items at or below their reorder point. */
export class DraftInventoryLowStockResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Draft purchase orders for the items at or below their reorder point. */
    @Mutation(() => DraftLowStockType, { name: "draftInventoryLowStock" })
    async draftInventoryLowStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DraftLowStockType> {
        const result = await this.commandBus.execute(
            new DraftInventoryLowStockCommand({ request: toDraftInventoryLowStockRequest(workspaceId), principal }),
        )
        return toDraftLowStockType(result)
    }
}
