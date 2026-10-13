import { Body, Controller, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BeginZaloAuthorizationCommand } from "../../application/begin-zalo-authorization.command"
import { CompleteZaloAuthorizationCommand } from "../../application/complete-zalo-authorization.command"
import { toCompleteRequest, toZaloAuthorizationResponse, toZaloConnectionResponse } from "./channels.mapper"
import { CompleteZaloAuthorizationRequest } from "./dto/complete-zalo-authorization.request"
import { ConnectionRequest } from "./dto/connection.request"
import { ZaloAuthorizationResponse } from "./dto/zalo-authorization.response"
import { ZaloConnectionResponse } from "./dto/zalo-connection.response"

@Controller("channels/zalo")
/** HTTP doors of connecting a Zalo OA; the service admits owner and manager of the requested workspace only. */
export class ChannelsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Finishes the permission flow with what Zalo returned the browser with. */
    @Post("authorize/complete")
    async complete(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CompleteZaloAuthorizationRequest,
    ): Promise<ZaloConnectionResponse> {
        const connectionId = await this.commandBus.execute(
            new CompleteZaloAuthorizationCommand({ request: toCompleteRequest(workspaceId, input), principal }),
        )
        return toZaloConnectionResponse(connectionId)
    }

    /** Starts the permission flow of a connection and answers the Zalo page to open. */
    @Post(":connectionId/authorize")
    async begin(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: ConnectionRequest,
    ): Promise<ZaloAuthorizationResponse> {
        const result = await this.commandBus.execute(
            new BeginZaloAuthorizationCommand({ request: { workspaceId, connectionId: params.connectionId }, principal }),
        )
        return toZaloAuthorizationResponse(result)
    }
}
