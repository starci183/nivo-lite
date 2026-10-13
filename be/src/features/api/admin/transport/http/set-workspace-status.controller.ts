import { Body, Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetWorkspaceStatusCommand } from "../../application/set-workspace-status.command"
import { toSetWorkspaceStatusRequest, toSetWorkspaceStatusResponse } from "./set-workspace-status.mapper"
import { SetWorkspaceStatusRequest as SetWorkspaceStatusHttpRequest } from "./dto/set-workspace-status.request"
import { SetWorkspaceStatusResponse } from "./dto/set-workspace-status.response"

@Controller("admin")
/** HTTP door of setWorkspaceStatus. */
export class SetWorkspaceStatusController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a workspace active or past due. */
    @Post("workspaces/:workspaceId/status")
    async setWorkspaceStatus(
        @CurrentPrincipal() principal: Principal,
        @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
        @Body() input: SetWorkspaceStatusHttpRequest,
    ): Promise<SetWorkspaceStatusResponse> {
        const result = await this.commandBus.execute(
            new SetWorkspaceStatusCommand({ request: toSetWorkspaceStatusRequest(workspaceId, input), principal }),
        )
        return toSetWorkspaceStatusResponse(result)
    }
}
