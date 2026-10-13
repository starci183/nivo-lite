import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CancelInventoryPoCommand } from "../../application/cancel-inventory-po.command"
import { InventoryPoRefInput } from "./dto/inventory-po-ref.input"
import { toCancelInventoryPoRequest } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: cancel a purchase order. */
export class CancelInventoryPoResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Cancel a purchase order. */
    @Mutation(() => Boolean, { name: "cancelInventoryPo" })
    async cancelInventoryPo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InventoryPoRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new CancelInventoryPoCommand({ request: toCancelInventoryPoRequest(workspaceId, input), principal }),
        )
        return true
    }
}
