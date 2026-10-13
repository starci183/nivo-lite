import { Controller, Get, Query } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListWorkspacesQuery } from "../../application/list-workspaces.query"
import { toListWorkspacesRequest, toListWorkspacesResponse } from "./list-workspaces.mapper"
import { ListWorkspacesRequest as ListWorkspacesHttpRequest } from "./dto/list-workspaces.request"
import { ListWorkspacesResponse } from "./dto/list-workspaces.response"

@Controller("admin")
/** HTTP door of listWorkspaces. */
export class ListWorkspacesController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists every customer workspace with billing, agents, connections and activity, filtered and searched. */
    @Get("workspaces")
    async listWorkspaces(
        @CurrentPrincipal() principal: Principal,
        @Query() input: ListWorkspacesHttpRequest,
    ): Promise<ListWorkspacesResponse> {
        const result = await this.queryBus.execute(
            new ListWorkspacesQuery({ request: toListWorkspacesRequest(input), principal }),
        )
        return toListWorkspacesResponse(result)
    }
}
