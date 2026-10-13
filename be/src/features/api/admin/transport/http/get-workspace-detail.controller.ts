import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetWorkspaceDetailQuery } from "../../application/get-workspace-detail.query"
import { toGetWorkspaceDetailRequest, toGetWorkspaceDetailResponse } from "./get-workspace-detail.mapper"
import { GetWorkspaceDetailResponse } from "./dto/get-workspace-detail.response"

@Controller("admin")
/** HTTP door of getWorkspaceDetail. */
export class GetWorkspaceDetailController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the read-only overview of one workspace. */
    @Get("workspaces/:workspaceId")
    async getWorkspaceDetail(
        @CurrentPrincipal() principal: Principal,
        @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
    ): Promise<GetWorkspaceDetailResponse> {
        const result = await this.queryBus.execute(
            new GetWorkspaceDetailQuery({ request: toGetWorkspaceDetailRequest(workspaceId), principal }),
        )
        return toGetWorkspaceDetailResponse(result)
    }
}
