import { Controller, Get, Param } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListApiKeysQuery } from "../../application/list-api-keys.query"
import { ListApiKeysRequest } from "./dto/list-api-keys.request"
import { ListApiKeysResponse } from "./dto/list-api-keys.response"
import { toListApiKeysRequest, toListApiKeysResponse } from "./list-api-keys.mapper"

@Controller("workspaces/:workspaceId/api-keys")
/** HTTP door of listing the API keys of a workspace. */
export class ListApiKeysController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the keys of the workspace for its owner or manager. */
    @Get()
    async listApiKeys(
        @CurrentPrincipal() principal: Principal,
        @Param() input: ListApiKeysRequest,
    ): Promise<ListApiKeysResponse> {
        const result = await this.queryBus.execute(
            new ListApiKeysQuery({ request: toListApiKeysRequest(input), principal }),
        )
        return toListApiKeysResponse(result)
    }
}
