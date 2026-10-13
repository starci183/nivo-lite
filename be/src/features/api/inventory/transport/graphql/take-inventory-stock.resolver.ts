import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TakeInventoryStockCommand } from "../../application/take-inventory-stock.command"
import { TakeStockType } from "./dto/take-stock.type"
import { TakeInventoryStockInput } from "./dto/take-inventory-stock.input"
import { toTakeInventoryStockRequest, toTakeStockType } from "./inventory-stock.mapper"

@Resolver()
/** GraphQL door: apply a stock count. */
export class TakeInventoryStockResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Apply a stock count. */
    @Mutation(() => TakeStockType, { name: "takeInventoryStock" })
    async takeInventoryStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TakeInventoryStockInput,
    ): Promise<TakeStockType> {
        const result = await this.commandBus.execute(
            new TakeInventoryStockCommand({ request: toTakeInventoryStockRequest(workspaceId, input), principal }),
        )
        return toTakeStockType(result)
    }
}
