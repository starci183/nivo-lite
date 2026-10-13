import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideWorkItemCommand } from "../../application/decide-work-item.command"
import { GetWorkItemQuery } from "../../application/get-work-item.query"
import { ListWorkItemPageQuery } from "../../application/list-work-item-page.query"
import { DecideWorkItemRequest } from "./dto/decide-work-item.request"
import { ListWorkItemsRequest } from "./dto/list-work-items.request"
import { WorkItemPageResponse } from "./dto/work-item-page.response"
import { WorkItemResponse } from "./dto/work-item.response"
import { WorkItemIdRequest } from "./dto/work-item-id.request"
import {
    toDecideWorkItemRequest,
    toListWorkItemsRequest,
    toWorkItemPageResponse,
    toWorkItemResponse,
} from "./decisions.mapper"

@Controller("decisions/work-items")
/** HTTP doors of the work items: the listing, one item and the decision of a person; the service proves membership and the right to decide. */
export class WorkItemsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists one page of the work items, newest first. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() input: ListWorkItemsRequest,
    ): Promise<WorkItemPageResponse> {
        const result = await this.queryBus.execute(
            new ListWorkItemPageQuery({ request: toListWorkItemsRequest(workspaceId, input), principal }),
        )
        return toWorkItemPageResponse(result)
    }

    /** Reads one work item. */
    @Get(":workItemId")
    async get(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: WorkItemIdRequest,
    ): Promise<WorkItemResponse> {
        const result = await this.queryBus.execute(
            new GetWorkItemQuery({ request: { workspaceId, workItemId: params.workItemId }, principal }),
        )
        return toWorkItemResponse(result)
    }

    /** Approves (optionally edited) or rejects a waiting work item; a double click decides once. */
    @Post(":workItemId/decision")
    @HttpCode(200)
    async decide(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Param() params: WorkItemIdRequest,
        @Body() input: DecideWorkItemRequest,
    ): Promise<WorkItemResponse> {
        const result = await this.commandBus.execute(
            new DecideWorkItemCommand({
                request: toDecideWorkItemRequest(workspaceId, params.workItemId, locale, input),
                principal,
            }),
        )
        return toWorkItemResponse(result)
    }
}
