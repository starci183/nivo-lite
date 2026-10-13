import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GetBookingPageQuery } from "../../application/get-booking-page.query"
import { toGetBookingPageRequest, toGetBookingPageResponse } from "./get-booking-page.mapper"
import { GetBookingPageParamsRequest } from "./dto/get-booking-page.request"
import type { GetBookingPageResponse } from "./dto/get-booking-page.response"
import { ListFreeTimesQuery } from "../../application/list-free-times.query"
import { toListFreeTimesRequest, toListFreeTimesResponse } from "./list-free-times.mapper"
import { ListFreeTimesParamsRequest, ListFreeTimesSearchRequest } from "./dto/list-free-times.request"
import type { ListFreeTimesResponse } from "./dto/list-free-times.response"
import { RequestBookingCommand } from "../../application/request-booking.command"
import { toRequestBookingRequest, toRequestBookingResponse } from "./request-booking.mapper"
import { RequestBookingParamsRequest, RequestBookingBodyRequest } from "./dto/request-booking.request"
import type { RequestBookingResponse } from "./dto/request-booking.response"

@Controller("public/booking")
/** The public booking page: what it shows, its free times and a visitor's request. */
export class PublicBookingController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Shows the published booking page of a slug. */
    @Get(":slug")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async getBookingPage(@Param() params: GetBookingPageParamsRequest): Promise<GetBookingPageResponse> {
        const result = await this.queryBus.execute(
            new GetBookingPageQuery({ request: toGetBookingPageRequest(params) }),
        )
        return toGetBookingPageResponse(result)
    }

    /** Lists the free start times of a service on a day. */
    @Get(":slug/slots")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async listFreeTimes(
        @Param() params: ListFreeTimesParamsRequest,
        @Query() query: ListFreeTimesSearchRequest,
    ): Promise<ListFreeTimesResponse> {
        const result = await this.queryBus.execute(
            new ListFreeTimesQuery({ request: toListFreeTimesRequest(params, query) }),
        )
        return toListFreeTimesResponse(result)
    }

    /** Records a visitor's booking request. */
    @Post(":slug/book")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async requestBooking(
        @Param() params: RequestBookingParamsRequest,
        @Body() body: RequestBookingBodyRequest,
    ): Promise<RequestBookingResponse> {
        const result = await this.commandBus.execute(
            new RequestBookingCommand({ request: toRequestBookingRequest(params, body) }),
        )
        return toRequestBookingResponse(result)
    }
}
