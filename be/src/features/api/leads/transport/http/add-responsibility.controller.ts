import { Body, Controller, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddResponsibilityCommand } from "../../application/add-responsibility.command"
import { toAddResponsibilityRequest, toAddResponsibilityResponse } from "./add-responsibility.mapper"
import { AddResponsibilityRequest } from "./dto/add-responsibility.request"
import { AddResponsibilityResponse } from "./dto/add-responsibility.response"

@Controller("leads")
/** HTTP door of add-responsibility. */
export class AddResponsibilityController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds the next responsibility of a lead, for any active member of the workspace. */
    @Post(":leadId/responsibilities")
    async addResponsibility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param("leadId", ParseUUIDPipe) leadId: string,
        @Body() input: AddResponsibilityRequest,
        @Headers("accept-language") acceptLanguage: string | undefined,
    ): Promise<AddResponsibilityResponse> {
        const result = await this.commandBus.execute(
            new AddResponsibilityCommand({
                request: toAddResponsibilityRequest(workspaceId, leadId, input, acceptLanguage),
                principal,
            }),
        )
        return toAddResponsibilityResponse(result)
    }
}
