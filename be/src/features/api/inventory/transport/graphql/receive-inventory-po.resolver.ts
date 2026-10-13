import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReceiveInventoryPoCommand } from "../../application/receive-inventory-po.command"
import { ReceivePoType } from "./dto/receive-po.type"
import { ReceiveInventoryPoInput } from "./dto/receive-inventory-po.input"
import { toReceiveInventoryPoRequest, toReceivePoType } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: receive goods against a purchase order. */
export class ReceiveInventoryPoResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Receive goods against a purchase order. */
    @Mutation(() => ReceivePoType, { name: "receiveInventoryPo" })
    async receiveInventoryPo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReceiveInventoryPoInput,
    ): Promise<ReceivePoType> {
        const result = await this.commandBus.execute(
            new ReceiveInventoryPoCommand({ request: toReceiveInventoryPoRequest(workspaceId, input), principal }),
        )
        return toReceivePoType(result)
    }
}
