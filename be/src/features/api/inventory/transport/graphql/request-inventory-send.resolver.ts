import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestInventorySendCommand } from "../../application/request-inventory-send.command"
import { RequestSendType } from "./dto/request-send.type"
import { RequestInventorySendInput } from "./dto/request-inventory-send.input"
import { toRequestInventorySendRequest, toRequestSendType } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: put a purchase order before the owner to send, or to remind the supplier. */
export class RequestInventorySendResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Put a purchase order before the owner to send, or to remind the supplier. */
    @Mutation(() => RequestSendType, { name: "requestInventorySend" })
    async requestInventorySend(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestInventorySendInput,
    ): Promise<RequestSendType> {
        const result = await this.commandBus.execute(
            new RequestInventorySendCommand({ request: toRequestInventorySendRequest(workspaceId, input), principal }),
        )
        return toRequestSendType(result)
    }
}
