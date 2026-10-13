import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { FinishWebhookCommand } from "../../application/finish-webhook.command"
import { RevealWebhookQuery } from "../../application/reveal-webhook.query"
import { RevealWebhookResponse } from "./dto/reveal-webhook.response"
import { StartWebhookBody } from "./dto/start-webhook.request"
import { StartWebhookCommand } from "../../application/start-webhook.command"
import { StartWebhookResponse } from "./dto/start-webhook.response"
import { TestWebhookCommand } from "../../application/test-webhook.command"
import { TestWebhookResponse } from "./dto/test-webhook.response"
import { UpdateWebhookEventsBody } from "./dto/update-webhook-events.request"
import { UpdateWebhookEventsCommand } from "../../application/update-webhook-events.command"
import { UpdateWebhookEventsResponse } from "./dto/update-webhook-events.response"
import {
    toFinishWebhookRequest,
    toRevealWebhookRequest,
    toRevealWebhookResponse,
    toStartWebhookRequest,
    toStartWebhookResponse,
    toTestWebhookRequest,
    toTestWebhookResponse,
    toUpdateWebhookEventsRequest,
    toUpdateWebhookEventsResponse,
} from "./webhook-connections.mapper"

@Controller()
/** HTTP doors of the outgoing webhook (n8n) connection wizard. */
export class WebhookConnectionsController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Starts an outgoing webhook connection. */
    @Post("connections/webhook")
    @HttpCode(200)
    async start(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Body() body: StartWebhookBody,
    ): Promise<StartWebhookResponse> {
        const result = await this.commandBus.execute(
            new StartWebhookCommand({ request: toStartWebhookRequest(workspaceId, body), principal }),
        )
        return toStartWebhookResponse(result)
    }

    /** Shows the signing secret and the events of a webhook connection again. */
    @Get("connections/:id/webhook")
    @HttpCode(200)
    async reveal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<RevealWebhookResponse> {
        const result = await this.queryBus.execute(
            new RevealWebhookQuery({ request: toRevealWebhookRequest(workspaceId, connectionId), principal }),
        )
        return toRevealWebhookResponse(result)
    }

    /** Changes which events a webhook connection receives. */
    @Put("connections/:id/webhook-events")
    @HttpCode(200)
    async updateEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
        @Body() body: UpdateWebhookEventsBody,
    ): Promise<UpdateWebhookEventsResponse> {
        const result = await this.commandBus.execute(
            new UpdateWebhookEventsCommand({
                request: toUpdateWebhookEventsRequest(workspaceId, connectionId, body),
                principal,
            }),
        )
        return toUpdateWebhookEventsResponse(result)
    }

    /** Sends a signed sample event to a webhook connection. */
    @Post("connections/:id/webhook-test")
    @HttpCode(200)
    async test(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<TestWebhookResponse> {
        const result = await this.commandBus.execute(
            new TestWebhookCommand({ request: toTestWebhookRequest(workspaceId, connectionId), principal }),
        )
        return toTestWebhookResponse(result)
    }

    /** Marks a webhook connection live. */
    @Post("connections/:id/webhook-finish")
    @HttpCode(204)
    async finish(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<void> {
        await this.commandBus.execute(
            new FinishWebhookCommand({ request: toFinishWebhookRequest(workspaceId, connectionId), principal }),
        )
    }
}
