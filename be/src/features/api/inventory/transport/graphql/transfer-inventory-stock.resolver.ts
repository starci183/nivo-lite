import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TransferInventoryStockCommand } from "../../application/transfer-inventory-stock.command"
import { TransferStockType } from "./dto/transfer-stock.type"
import { TransferInventoryStockInput } from "./dto/transfer-inventory-stock.input"
import { toTransferInventoryStockRequest, toTransferStockType } from "./inventory-stock.mapper"

@Resolver()
/** GraphQL door: move goods between two locations. */
export class TransferInventoryStockResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Move goods between two locations. */
    @Mutation(() => TransferStockType, { name: "transferInventoryStock" })
    async transferInventoryStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TransferInventoryStockInput,
    ): Promise<TransferStockType> {
        const result = await this.commandBus.execute(
            new TransferInventoryStockCommand({
                request: toTransferInventoryStockRequest(workspaceId, input),
                principal,
            }),
        )
        return toTransferStockType(result)
    }
}
