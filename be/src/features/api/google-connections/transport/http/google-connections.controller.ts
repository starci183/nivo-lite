import { Body, Controller, Get, HttpCode, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GoogleAccountsQuery } from "../../application/google-accounts.query"
import { GoogleAccountsResponse } from "./dto/google-accounts.response"
import { GoogleAuthorizeBody } from "./dto/google-authorize.request"
import { GoogleAuthorizeCommand } from "../../application/google-authorize.command"
import { GoogleAuthorizeResponse } from "./dto/google-authorize.response"
import { GoogleStateQuery } from "../../application/google-state.query"
import { GoogleStateResponse } from "./dto/google-state.response"
import {
    toGoogleAccountsRequest,
    toGoogleAccountsResponse,
    toGoogleAuthorizeRequest,
    toGoogleAuthorizeResponse,
    toGoogleStateRequest,
    toGoogleStateResponse,
} from "./google-connections.mapper"

@Controller()
/** HTTP doors of the Google account connections (owner or manager). */
export class GoogleConnectionsController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Starts the Google consent and answers the Google url. */
    @Post("connections/google/authorize")
    @HttpCode(200)
    async authorize(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: GoogleAuthorizeBody,
    ): Promise<GoogleAuthorizeResponse> {
        const result = await this.commandBus.execute(
            new GoogleAuthorizeCommand({ request: toGoogleAuthorizeRequest(workspaceId, body), principal }),
        )
        return toGoogleAuthorizeResponse(result)
    }

    /** Lists the live Google accounts of the workspace. */
    @Get("google/accounts")
    @HttpCode(200)
    async accounts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
    ): Promise<GoogleAccountsResponse> {
        const result = await this.queryBus.execute(
            new GoogleAccountsQuery({ request: toGoogleAccountsRequest(workspaceId), principal }),
        )
        return toGoogleAccountsResponse(result)
    }

    /** Says whether Google is set up on this deployment. */
    @Get("google/state")
    @HttpCode(200)
    async state(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
    ): Promise<GoogleStateResponse> {
        const result = await this.queryBus.execute(
            new GoogleStateQuery({ request: toGoogleStateRequest(workspaceId), principal }),
        )
        return toGoogleStateResponse(result)
    }
}
