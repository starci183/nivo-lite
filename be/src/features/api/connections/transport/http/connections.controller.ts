import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { WorkspaceHeader } from "@modules/domain/connections"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckFirstEventQuery } from "../../application/check-first-event.query"
import { WantConnectorCommand } from "../../application/want-connector.command"
import { toFirstEventResponse } from "./connections.mapper"
import { ConnectorInterestParams } from "./dto/connector-interest.request"
import { FirstEventResponse } from "./dto/first-event.response"

@Controller()
/** HTTP doors of the connections console: the wizard polling and the interest in a planned connector. */
export class ConnectionsController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Has the first event reached this connection (owner or manager). */
    @Get("connections/:id/first-event")
    async firstEvent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param("id", new ParseUUIDPipe()) connectionId: string,
    ): Promise<FirstEventResponse> {
        const result = await this.queryBus.execute(
            new CheckFirstEventQuery({ request: { workspaceId, connectionId }, principal }),
        )
        return toFirstEventResponse(result)
    }

    /** Says the workspace wants a planned connector (owner or manager); recorded once. */
    @Post("connector-interest/:connectorId")
    @HttpCode(204)
    async wantConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceHeader(undefined, new ParseUUIDPipe()) workspaceId: string,
        @Param() params: ConnectorInterestParams,
    ): Promise<void> {
        await this.commandBus.execute(
            new WantConnectorCommand({ request: { workspaceId, connectorId: params.connectorId }, principal }),
        )
    }
}
