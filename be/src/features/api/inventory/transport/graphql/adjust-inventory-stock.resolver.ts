import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AdjustInventoryStockCommand } from "../../application/adjust-inventory-stock.command"
import { AdjustStockType } from "./dto/adjust-stock.type"
import { AdjustInventoryStockInput } from "./dto/adjust-inventory-stock.input"
import { toAdjustInventoryStockRequest, toAdjustStockType } from "./inventory-stock.mapper"

@Resolver()
/** GraphQL door: change one item's quantity by hand. */
export class AdjustInventoryStockResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Change one item's quantity by hand. */
    @Mutation(() => AdjustStockType, { name: "adjustInventoryStock" })
    async adjustInventoryStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AdjustInventoryStockInput,
    ): Promise<AdjustStockType> {
        const result = await this.commandBus.execute(
            new AdjustInventoryStockCommand({ request: toAdjustInventoryStockRequest(workspaceId, input), principal }),
        )
        return toAdjustStockType(result)
    }
}
