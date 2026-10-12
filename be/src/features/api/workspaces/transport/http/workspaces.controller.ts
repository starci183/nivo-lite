import { Body, Controller, Get, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateWorkspaceCommand } from "../../application/create-workspace.command"
import { ListMembersQuery } from "../../application/list-members.query"
import { ListMembershipsQuery } from "../../application/list-memberships.query"
import { CreateWorkspaceRequest } from "./dto/create-workspace.request"
import { CreateWorkspaceResponse } from "./dto/create-workspace.response"
import { MemberListingResponse } from "./dto/members.response"
import { MembershipResponse } from "./dto/memberships.response"
import { toCreateWorkspaceResponse, toMembersResponse, toMembershipsResponse } from "./workspaces.mapper"

@Controller("workspaces")
/** HTTP doors of the caller's workspaces and their members. */
export class WorkspacesController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists every workspace the caller belongs to with their membership in each. */
    @Get()
    async memberships(@CurrentPrincipal() principal: Principal): Promise<Array<MembershipResponse>> {
        const result = await this.queryBus.execute(new ListMembershipsQuery({ request: {}, principal }))
        return toMembershipsResponse(result)
    }

    /** Creates a free workspace owned by the caller, where the environment allows it. */
    @Post()
    async create(
        @CurrentPrincipal() principal: Principal,
        @Body() input: CreateWorkspaceRequest,
    ): Promise<CreateWorkspaceResponse> {
        const result = await this.commandBus.execute(
            new CreateWorkspaceCommand({ request: { name: input.name }, principal }),
        )
        return toCreateWorkspaceResponse(result)
    }

    /** Lists everyone in the requested workspace; emails are blank for staff. */
    @Get("members")
    async members(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<MemberListingResponse>> {
        const result = await this.queryBus.execute(new ListMembersQuery({ request: { workspaceId }, principal }))
        return toMembersResponse(result)
    }
}
