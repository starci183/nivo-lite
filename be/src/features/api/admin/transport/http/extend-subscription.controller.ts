import { Body, Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ExtendSubscriptionCommand } from "../../application/extend-subscription.command"
import { toExtendSubscriptionRequest, toExtendSubscriptionResponse } from "./extend-subscription.mapper"
import { ExtendSubscriptionRequest as ExtendSubscriptionHttpRequest } from "./dto/extend-subscription.request"
import { ExtendSubscriptionResponse } from "./dto/extend-subscription.response"

@Controller("admin")
/** HTTP door of extendSubscription. */
export class ExtendSubscriptionController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Extends a workspace's subscription by a number of days. */
    @Post("workspaces/:workspaceId/extend")
    async extendSubscription(
        @CurrentPrincipal() principal: Principal,
        @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
        @Body() input: ExtendSubscriptionHttpRequest,
    ): Promise<ExtendSubscriptionResponse> {
        const result = await this.commandBus.execute(
            new ExtendSubscriptionCommand({ request: toExtendSubscriptionRequest(workspaceId, input), principal }),
        )
        return toExtendSubscriptionResponse(result)
    }
}
