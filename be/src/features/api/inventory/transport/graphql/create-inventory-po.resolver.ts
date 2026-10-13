import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateInventoryPoCommand } from "../../application/create-inventory-po.command"
import { InventoryRefType } from "./dto/inventory-ref.type"
import { CreateInventoryPoInput } from "./dto/create-inventory-po.input"
import { toCreateInventoryPoRequest, toInventoryRefType } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: create a draft purchase order. */
export class CreateInventoryPoResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create a draft purchase order. */
    @Mutation(() => InventoryRefType, { name: "createInventoryPo" })
    async createInventoryPo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateInventoryPoInput,
    ): Promise<InventoryRefType> {
        const result = await this.commandBus.execute(
            new CreateInventoryPoCommand({ request: toCreateInventoryPoRequest(workspaceId, input), principal }),
        )
        return toInventoryRefType(result)
    }
}
