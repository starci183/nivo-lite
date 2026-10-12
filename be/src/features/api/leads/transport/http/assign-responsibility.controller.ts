import { Body, Controller, Headers, Param, ParseUUIDPipe, Patch } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AssignResponsibilityCommand } from "../../application/assign-responsibility.command"
import { toAssignResponsibilityRequest, toAssignResponsibilityResponse } from "./assign-responsibility.mapper"
import { AssignResponsibilityRequest } from "./dto/assign-responsibility.request"
import { AssignResponsibilityResponse } from "./dto/assign-responsibility.response"

@Controller("responsibilities")
/** HTTP door of assign-responsibility. */
export class AssignResponsibilityController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes the owner, next action and due date of a step, for any active member of the workspace. */
    @Patch(":responsibilityId")
    async assignResponsibility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param("responsibilityId", ParseUUIDPipe) responsibilityId: string,
        @Body() input: AssignResponsibilityRequest,
        @Headers("accept-language") acceptLanguage: string | undefined,
    ): Promise<AssignResponsibilityResponse> {
        const result = await this.commandBus.execute(
            new AssignResponsibilityCommand({
                request: toAssignResponsibilityRequest(workspaceId, responsibilityId, input, acceptLanguage),
                principal,
            }),
        )
        return toAssignResponsibilityResponse(result)
    }
}
