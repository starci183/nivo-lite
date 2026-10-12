import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CopyInviteLinkCommand } from "../../application/copy-invite-link.command"
import { CreateInviteCommand } from "../../application/create-invite.command"
import { ListInvitesQuery } from "../../application/list-invites.query"
import { ResendInviteCommand } from "../../application/resend-invite.command"
import { RevokeInviteCommand } from "../../application/revoke-invite.command"
import { CreateInviteRequest } from "./dto/create-invite.request"
import { InviteIdRequest } from "./dto/invite-id.request"
import { InviteResultResponse } from "./dto/invite-result.response"
import { PendingInviteResponse } from "./dto/invites.response"
import { toCreateInviteRequest, toInviteResultResponse, toInvitesResponse } from "./workspaces.mapper"

@Controller("workspaces/invites")
/** HTTP doors of the invitations of the requested workspace; the service admits owner and manager only. */
export class WorkspaceInvitesController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the invitations that can still be accepted. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<PendingInviteResponse>> {
        const result = await this.queryBus.execute(new ListInvitesQuery({ request: { workspaceId }, principal }))
        return toInvitesResponse(result)
    }

    /** Invites a person; the link in the answer is the only place the token appears. */
    @Post()
    async create(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CreateInviteRequest,
    ): Promise<InviteResultResponse> {
        const result = await this.commandBus.execute(
            new CreateInviteCommand({ request: toCreateInviteRequest(workspaceId, input), principal }),
        )
        return toInviteResultResponse(result)
    }

    /** Emails a pending invitation again with a new link. */
    @Post(":inviteId/resend")
    async resend(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: InviteIdRequest,
    ): Promise<InviteResultResponse> {
        const result = await this.commandBus.execute(
            new ResendInviteCommand({ request: { workspaceId, inviteId: params.inviteId }, principal }),
        )
        return toInviteResultResponse(result)
    }

    /** Issues a fresh link to a pending invitation without emailing it. */
    @Post(":inviteId/link")
    async link(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: InviteIdRequest,
    ): Promise<InviteResultResponse> {
        const result = await this.commandBus.execute(
            new CopyInviteLinkCommand({ request: { workspaceId, inviteId: params.inviteId }, principal }),
        )
        return toInviteResultResponse(result)
    }

    /** Revokes a pending invitation; its link stops working at once. */
    @Delete(":inviteId")
    @HttpCode(204)
    revoke(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: InviteIdRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new RevokeInviteCommand({ request: { workspaceId, inviteId: params.inviteId }, principal }),
        )
    }
}
