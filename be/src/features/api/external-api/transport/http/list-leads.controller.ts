import { Controller, Get, Headers, Query } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ListLeadsQuery } from "../../application/list-leads.query"
import { ListLeadsRequest } from "./dto/list-leads.request"
import { ListLeadsResponse } from "./dto/list-leads.response"
import { toListLeadsRequest, toListLeadsResponse } from "./list-leads.mapper"

@Controller("api/v1/leads")
/** HTTP door of listing customers: the public API, authenticated by the bearer API key inside the operation. */
export class ListLeadsController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the customers of the key's workspace, newest first. */
    @Get()
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async listLeads(
        @Headers("authorization") authorization: string | undefined,
        @Query() input: ListLeadsRequest,
    ): Promise<ListLeadsResponse> {
        const result = await this.queryBus.execute(
            new ListLeadsQuery({ request: toListLeadsRequest(authorization, input) }),
        )
        return toListLeadsResponse(result)
    }
}
