import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckMetaBody } from "./dto/check-meta.request"
import { CheckMetaCommand } from "../../application/check-meta.command"
import { CheckMetaResponse } from "./dto/check-meta.response"
import { ChooseMetaPageBody } from "./dto/choose-meta-page.request"
import { ChooseMetaPageCommand } from "../../application/choose-meta-page.command"
import { ChooseMetaPageResponse } from "./dto/choose-meta-page.response"
import { MetaAuthorizeBody } from "./dto/meta-authorize.request"
import { MetaAuthorizeCommand } from "../../application/meta-authorize.command"
import { MetaAuthorizeResponse } from "./dto/meta-authorize.response"
import { ResumeMetaQuery } from "../../application/resume-meta.query"
import { ResumeMetaResponse } from "./dto/resume-meta.response"
import {
    toCheckMetaRequest,
    toCheckMetaResponse,
    toChooseMetaPageRequest,
    toChooseMetaPageResponse,
    toMetaAuthorizeRequest,
    toMetaAuthorizeResponse,
    toResumeMetaRequest,
    toResumeMetaResponse,
} from "./meta-connections.mapper"

@Controller()
/** HTTP doors of the Facebook Pages and Instagram connection wizard. */
export class MetaConnectionsController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Starts the Meta login. */
    @Post("connections/meta/authorize")
    @HttpCode(200)
    async authorize(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: MetaAuthorizeBody,
    ): Promise<MetaAuthorizeResponse> {
        const result = await this.commandBus.execute(
            new MetaAuthorizeCommand({ request: toMetaAuthorizeRequest(workspaceId, body), principal }),
        )
        return toMetaAuthorizeResponse(result)
    }

    /** Reopens an unfinished Meta connection. */
    @Get("connections/:id/meta")
    @HttpCode(200)
    async resume(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<ResumeMetaResponse> {
        const result = await this.queryBus.execute(
            new ResumeMetaQuery({ request: toResumeMetaRequest(workspaceId, connectionId), principal }),
        )
        return toResumeMetaResponse(result)
    }

    /** Chooses the Page of a Meta connection. */
    @Post("connections/:id/meta-page")
    @HttpCode(200)
    async choosePage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: ChooseMetaPageBody,
    ): Promise<ChooseMetaPageResponse> {
        const result = await this.commandBus.execute(
            new ChooseMetaPageCommand({ request: toChooseMetaPageRequest(workspaceId, connectionId, body), principal }),
        )
        return toChooseMetaPageResponse(result)
    }

    /** Asks Meta what it has for a connection. */
    @Post("connections/:id/meta-check")
    @HttpCode(200)
    async check(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: CheckMetaBody,
    ): Promise<CheckMetaResponse> {
        const result = await this.commandBus.execute(
            new CheckMetaCommand({ request: toCheckMetaRequest(workspaceId, connectionId, body), principal }),
        )
        return toCheckMetaResponse(result)
    }
}
