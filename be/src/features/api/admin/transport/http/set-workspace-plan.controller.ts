import { Body, Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetWorkspacePlanCommand } from "../../application/set-workspace-plan.command"
import { toSetWorkspacePlanRequest, toSetWorkspacePlanResponse } from "./set-workspace-plan.mapper"
import { SetWorkspacePlanRequest as SetWorkspacePlanHttpRequest } from "./dto/set-workspace-plan.request"
import { SetWorkspacePlanResponse } from "./dto/set-workspace-plan.response"

@Controller("admin")
/** HTTP door of setWorkspacePlan. */
export class SetWorkspacePlanController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Moves a workspace to another plan and sets its own monthly credit allowance. */
    @Post("workspaces/:workspaceId/plan")
    async setWorkspacePlan(
        @CurrentPrincipal() principal: Principal,
        @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
        @Body() input: SetWorkspacePlanHttpRequest,
    ): Promise<SetWorkspacePlanResponse> {
        const result = await this.commandBus.execute(
            new SetWorkspacePlanCommand({ request: toSetWorkspacePlanRequest(workspaceId, input), principal }),
        )
        return toSetWorkspacePlanResponse(result)
    }
}
