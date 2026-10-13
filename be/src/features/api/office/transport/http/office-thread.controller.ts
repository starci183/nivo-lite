import { Controller, Get, Query } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListDecidedApprovalsQuery } from "../../application/list-decided-approvals.query"
import { ListPendingApprovalsQuery } from "../../application/list-pending-approvals.query"
import { ListThreadMessagesQuery } from "../../application/list-thread-messages.query"
import { ApprovalResponse } from "./dto/approval.response"
import { ListThreadMessagesRequest } from "./dto/list-thread-messages.request"
import { MessagePageResponse } from "./dto/message-page.response"
import { toApprovalsResponse, toMessagePageResponse, toThreadQueryRequest } from "./office.mapper"

@Controller("office")
/** HTTP doors of the Office read model: the thread and the approval cards around it. */
export class OfficeThreadController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one page of the Office thread, newest first. */
    @Get("messages")
    async messages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() input: ListThreadMessagesRequest,
    ): Promise<MessagePageResponse> {
        const result = await this.queryBus.execute(
            new ListThreadMessagesQuery({ request: toThreadQueryRequest(workspaceId, input), principal }),
        )
        return toMessagePageResponse(result)
    }

    /** Lists the approval cards waiting for a decision. */
    @Get("approvals/pending")
    async pending(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ApprovalResponse>> {
        const result = await this.queryBus.execute(
            new ListPendingApprovalsQuery({ request: { workspaceId }, principal }),
        )
        return toApprovalsResponse(result)
    }

    /** Lists the approval cards decided most recently. */
    @Get("approvals/decided")
    async decided(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ApprovalResponse>> {
        const result = await this.queryBus.execute(
            new ListDecidedApprovalsQuery({ request: { workspaceId }, principal }),
        )
        return toApprovalsResponse(result)
    }
}
