import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateResponsibilityCommand } from "../../application/create-responsibility.command"
import { ListResponsibilitiesQuery } from "../../application/list-responsibilities.query"
import { UpdateResponsibilityStatusCommand } from "../../application/update-responsibility-status.command"
import { CreateResponsibilityRequest } from "./dto/create-responsibility.request"
import { ResponsibilityIdRequest } from "./dto/responsibility-id.request"
import { ResponsibilityListingResponse, ResponsibilityResponse } from "./dto/responsibility.response"
import { UpdateResponsibilityStatusRequest } from "./dto/update-responsibility-status.request"
import { toCreateResponsibilityRequest, toResponsibilitiesResponse, toResponsibilityResponse } from "./decisions.mapper"

@Controller("decisions/responsibilities")
/** HTTP doors of the responsibilities journal: what each person or agent owes a customer. */
export class ResponsibilitiesController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the responsibilities with their customer, open ones first. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ResponsibilityListingResponse>> {
        const result = await this.queryBus.execute(
            new ListResponsibilitiesQuery({ request: { workspaceId }, principal }),
        )
        return toResponsibilitiesResponse(result)
    }

    /** Adds a responsibility for a customer. */
    @Post()
    async create(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CreateResponsibilityRequest,
    ): Promise<ResponsibilityResponse> {
        const result = await this.commandBus.execute(
            new CreateResponsibilityCommand({ request: toCreateResponsibilityRequest(workspaceId, input), principal }),
        )
        return toResponsibilityResponse(result)
    }

    /** Moves a responsibility to a status. */
    @Patch(":responsibilityId/status")
    async updateStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: ResponsibilityIdRequest,
        @Body() input: UpdateResponsibilityStatusRequest,
    ): Promise<ResponsibilityResponse> {
        const result = await this.commandBus.execute(
            new UpdateResponsibilityStatusCommand({
                request: { workspaceId, responsibilityId: params.responsibilityId, status: input.status },
                principal,
            }),
        )
        return toResponsibilityResponse(result)
    }
}
