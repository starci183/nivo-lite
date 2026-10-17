import { Controller, Get, Headers, Query } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ListEventsQuery } from "../../application/list-events.query"
import { ListEventsRequest } from "./dto/list-events.request"
import { ListEventsResponse } from "./dto/list-events.response"
import { toListEventsRequest, toListEventsResponse } from "./list-events.mapper"

@Controller("api/v1/events")
/**
 * HTTP door of listing events: the public API, authenticated by an API-key guard; the operation checks scope and rate
 * budget.
 */
export class ListEventsController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the evidence log of the key's workspace after `since`, oldest first. */
    @Get()
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async listEvents(
        @Headers("authorization") authorization: string | undefined,
        @Query() input: ListEventsRequest,
    ): Promise<ListEventsResponse> {
        const result = await this.queryBus.execute(
            new ListEventsQuery({ request: toListEventsRequest(authorization, input) }),
        )
        return toListEventsResponse(result)
    }
}
