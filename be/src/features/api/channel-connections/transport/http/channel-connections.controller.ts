import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckConnectionCommand } from "../../application/check-connection.command"
import { CheckConnectionResponse } from "./dto/check-connection.response"
import { ConnectTelegramBody } from "./dto/connect-telegram.request"
import { ConnectTelegramCommand } from "../../application/connect-telegram.command"
import { ConnectTelegramResponse } from "./dto/connect-telegram.response"
import { ResumeConnectionQuery } from "../../application/resume-connection.query"
import { ResumeConnectionResponse } from "./dto/resume-connection.response"
import { ResumeZaloQuery } from "../../application/resume-zalo.query"
import { ResumeZaloResponse } from "./dto/resume-zalo.response"
import { RevealSepayKeyQuery } from "../../application/reveal-sepay-key.query"
import { RevealSepayKeyResponse } from "./dto/reveal-sepay-key.response"
import { SaveProviderKeysBody } from "./dto/save-provider-keys.request"
import { SaveProviderKeysCommand } from "../../application/save-provider-keys.command"
import { SaveProviderKeysResponse } from "./dto/save-provider-keys.response"
import { SaveZaloOaSecretBody } from "./dto/save-zalo-oa-secret.request"
import { SaveZaloOaSecretCommand } from "../../application/save-zalo-oa-secret.command"
import { StartMoneyBody } from "./dto/start-money.request"
import { StartMoneyCommand } from "../../application/start-money.command"
import { StartMoneyResponse } from "./dto/start-money.response"
import { StartZaloBody } from "./dto/start-zalo.request"
import { StartZaloCommand } from "../../application/start-zalo.command"
import { StartZaloResponse } from "./dto/start-zalo.response"
import { UpdateMoneyBody } from "./dto/update-money.request"
import { UpdateMoneyCommand } from "../../application/update-money.command"
import { UpdateMoneyResponse } from "./dto/update-money.response"
import { ZaloAuthorizeCommand } from "../../application/zalo-authorize.command"
import { ZaloAuthorizeResponse } from "./dto/zalo-authorize.response"
import {
    toCheckConnectionRequest,
    toCheckConnectionResponse,
    toConnectTelegramRequest,
    toConnectTelegramResponse,
    toResumeConnectionRequest,
    toResumeConnectionResponse,
    toResumeZaloRequest,
    toResumeZaloResponse,
    toRevealSepayKeyRequest,
    toRevealSepayKeyResponse,
    toSaveProviderKeysRequest,
    toSaveProviderKeysResponse,
    toSaveZaloOaSecretRequest,
    toStartMoneyRequest,
    toStartMoneyResponse,
    toStartZaloRequest,
    toStartZaloResponse,
    toUpdateMoneyRequest,
    toUpdateMoneyResponse,
    toZaloAuthorizeRequest,
    toZaloAuthorizeResponse,
} from "./channel-connections.mapper"

@Controller()
/** HTTP doors of the Telegram, bank feed and Zalo OA connection wizards (owner only, except the check). */
export class ChannelConnectionsController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Connects a Telegram bot. */
    @Post("connections/telegram")
    @HttpCode(200)
    async connectTelegram(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: ConnectTelegramBody,
    ): Promise<ConnectTelegramResponse> {
        const result = await this.commandBus.execute(
            new ConnectTelegramCommand({ request: toConnectTelegramRequest(workspaceId, body), principal }),
        )
        return toConnectTelegramResponse(result)
    }

    /** Starts a bank or payment feed connection. */
    @Post("connections/money")
    @HttpCode(200)
    async startMoneyConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: StartMoneyBody,
    ): Promise<StartMoneyResponse> {
        const result = await this.commandBus.execute(
            new StartMoneyCommand({ request: toStartMoneyRequest(workspaceId, body), principal }),
        )
        return toStartMoneyResponse(result)
    }

    /** Edits a bank or payment feed connection. */
    @Patch("connections/:id/money")
    @HttpCode(200)
    async updateMoneyConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: UpdateMoneyBody,
    ): Promise<UpdateMoneyResponse> {
        const result = await this.commandBus.execute(
            new UpdateMoneyCommand({ request: toUpdateMoneyRequest(workspaceId, connectionId, body), principal }),
        )
        return toUpdateMoneyResponse(result)
    }

    /** Reopens an unfinished bank or payment feed connection. */
    @Get("connections/:id/wizard")
    @HttpCode(200)
    async resumeConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<ResumeConnectionResponse> {
        const result = await this.queryBus.execute(
            new ResumeConnectionQuery({ request: toResumeConnectionRequest(workspaceId, connectionId), principal }),
        )
        return toResumeConnectionResponse(result)
    }

    /** Shows the SePay API key again. */
    @Get("connections/:id/sepay-key")
    @HttpCode(200)
    async revealSepayKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<RevealSepayKeyResponse> {
        const result = await this.queryBus.execute(
            new RevealSepayKeyQuery({ request: toRevealSepayKeyRequest(workspaceId, connectionId), principal }),
        )
        return toRevealSepayKeyResponse(result)
    }

    /** Saves the keys copied from a payment provider. */
    @Put("connections/:id/provider-keys")
    @HttpCode(200)
    async saveProviderKeys(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: SaveProviderKeysBody,
    ): Promise<SaveProviderKeysResponse> {
        const result = await this.commandBus.execute(
            new SaveProviderKeysCommand({
                request: toSaveProviderKeysRequest(workspaceId, connectionId, body),
                principal,
            }),
        )
        return toSaveProviderKeysResponse(result)
    }

    /** Starts a Zalo OA connection. */
    @Post("connections/zalo")
    @HttpCode(200)
    async startZaloConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: StartZaloBody,
    ): Promise<StartZaloResponse> {
        const result = await this.commandBus.execute(
            new StartZaloCommand({ request: toStartZaloRequest(workspaceId, body), principal }),
        )
        return toStartZaloResponse(result)
    }

    /** Reopens an unfinished Zalo OA connection. */
    @Get("connections/:id/zalo")
    @HttpCode(200)
    async resumeZalo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<ResumeZaloResponse> {
        const result = await this.queryBus.execute(
            new ResumeZaloQuery({ request: toResumeZaloRequest(workspaceId, connectionId), principal }),
        )
        return toResumeZaloResponse(result)
    }

    /** Saves the OA secret key of the Zalo webhook screen. */
    @Put("connections/:id/zalo-oa-secret")
    @HttpCode(204)
    async saveZaloOaSecret(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: SaveZaloOaSecretBody,
    ): Promise<void> {
        await this.commandBus.execute(
            new SaveZaloOaSecretCommand({
                request: toSaveZaloOaSecretRequest(workspaceId, connectionId, body),
                principal,
            }),
        )
    }

    /** Starts the Zalo authorization and answers the permission url. */
    @Post("connections/:id/zalo-authorize")
    @HttpCode(200)
    async zaloAuthorizeUrl(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<ZaloAuthorizeResponse> {
        const result = await this.commandBus.execute(
            new ZaloAuthorizeCommand({ request: toZaloAuthorizeRequest(workspaceId, connectionId), principal }),
        )
        return toZaloAuthorizeResponse(result)
    }

    /** Asks the provider what it knows about a connection. */
    @Post("connections/:id/check")
    @HttpCode(200)
    async check(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<CheckConnectionResponse> {
        const result = await this.commandBus.execute(
            new CheckConnectionCommand({ request: toCheckConnectionRequest(workspaceId, connectionId), principal }),
        )
        return toCheckConnectionResponse(result)
    }
}
