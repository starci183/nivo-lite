import { Body, Controller, Get, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptInviteCommand } from "../../application/accept-invite.command"
import { PreviewInviteQuery } from "../../application/preview-invite.query"
import { AcceptInviteRequest } from "./dto/accept-invite.request"
import { AcceptInviteResponse } from "./dto/accept-invite.response"
import { InvitePreviewResponse } from "./dto/invite-preview.response"
import { InviteTokenRequest } from "./dto/invite-token.request"
import { toAcceptInviteResponse, toInvitePreviewResponse } from "./workspaces.mapper"

@Controller("invites")
/** HTTP doors of an invitation link for the signed-in person who received it. */
export class InvitesController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Shows what the invitation offers before it is accepted. */
    @Get(":token/preview")
    async preview(@Param() params: InviteTokenRequest): Promise<InvitePreviewResponse> {
        const result = await this.queryBus.execute(new PreviewInviteQuery({ request: { token: params.token } }))
        return toInvitePreviewResponse(result)
    }

    /** Joins the caller to the invited workspace when the signed-in address matches the invitation. */
    @Post("accept")
    async accept(
        @CurrentPrincipal() principal: Principal,
        @Body() input: AcceptInviteRequest,
    ): Promise<AcceptInviteResponse> {
        const result = await this.commandBus.execute(
            new AcceptInviteCommand({ request: { token: input.token }, principal }),
        )
        return toAcceptInviteResponse(result)
    }
}
