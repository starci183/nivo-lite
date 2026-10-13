import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBookingOverviewQuery } from "../../application/get-booking-overview.query"
import { toGetBookingOverviewRequest, toGetBookingOverviewResponse } from "./get-booking-overview.mapper"
import { GetBookingOverviewParamsRequest, GetBookingOverviewSearchRequest } from "./dto/get-booking-overview.request"
import type { GetBookingOverviewResponse } from "./dto/get-booking-overview.response"
import { AddBookingCommand } from "../../application/add-booking.command"
import { toHttpAddBookingRequest, toAddBookingResponse } from "./add-booking.mapper"
import { AddBookingParamsRequest, AddBookingBodyRequest } from "./dto/add-booking.request"
import type { AddBookingResponse } from "./dto/add-booking.response"
import { MoveBookingCommand } from "../../application/move-booking.command"
import { toMoveBookingRequest, toMoveBookingResponse } from "./move-booking.mapper"
import { MoveBookingParamsRequest, MoveBookingBodyRequest } from "./dto/move-booking.request"
import type { MoveBookingResponse } from "./dto/move-booking.response"
import { ConfirmBookingCommand } from "../../application/confirm-booking.command"
import { toConfirmBookingRequest, toConfirmBookingResponse } from "./confirm-booking.mapper"
import { ConfirmBookingParamsRequest } from "./dto/confirm-booking.request"
import type { ConfirmBookingResponse } from "./dto/confirm-booking.response"
import { CheckInBookingCommand } from "../../application/check-in-booking.command"
import { toCheckInBookingRequest, toCheckInBookingResponse } from "./check-in-booking.mapper"
import { CheckInBookingParamsRequest } from "./dto/check-in-booking.request"
import type { CheckInBookingResponse } from "./dto/check-in-booking.response"
import { CompleteBookingCommand } from "../../application/complete-booking.command"
import { toCompleteBookingRequest, toCompleteBookingResponse } from "./complete-booking.mapper"
import { CompleteBookingParamsRequest } from "./dto/complete-booking.request"
import type { CompleteBookingResponse } from "./dto/complete-booking.response"
import { MarkNoShowCommand } from "../../application/mark-no-show.command"
import { toMarkNoShowRequest, toMarkNoShowResponse } from "./mark-no-show.mapper"
import { MarkNoShowParamsRequest } from "./dto/mark-no-show.request"
import type { MarkNoShowResponse } from "./dto/mark-no-show.response"
import { CancelBookingCommand } from "../../application/cancel-booking.command"
import { toCancelBookingRequest, toCancelBookingResponse } from "./cancel-booking.mapper"
import { CancelBookingParamsRequest } from "./dto/cancel-booking.request"
import type { CancelBookingResponse } from "./dto/cancel-booking.response"

@Controller("booking/workspaces/:workspaceId")
/** The owner desk of the booking calendar. */
export class BookingController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Shows the figures and statistics of the calendar. */
    @Get("overview")
    async getBookingOverview(
        @CurrentPrincipal() principal: Principal,
        @Param() params: GetBookingOverviewParamsRequest,
        @Query() query: GetBookingOverviewSearchRequest,
    ): Promise<GetBookingOverviewResponse> {
        const result = await this.queryBus.execute(
            new GetBookingOverviewQuery({ request: toGetBookingOverviewRequest(params, query), principal }),
        )
        return toGetBookingOverviewResponse(result)
    }

    /** Adds a booking by hand. */
    @Post("bookings")
    async addBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: AddBookingParamsRequest,
        @Body() body: AddBookingBodyRequest,
    ): Promise<AddBookingResponse> {
        const result = await this.commandBus.execute(
            new AddBookingCommand({ request: toHttpAddBookingRequest(params, body), principal }),
        )
        return toAddBookingResponse(result)
    }

    /** Moves a booking to another time or resource. */
    @Post("bookings/:id/move")
    async moveBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: MoveBookingParamsRequest,
        @Body() body: MoveBookingBodyRequest,
    ): Promise<MoveBookingResponse> {
        const result = await this.commandBus.execute(
            new MoveBookingCommand({ request: toMoveBookingRequest(params, body), principal }),
        )
        return toMoveBookingResponse(result)
    }

    /** Confirms a requested booking. */
    @Post("bookings/:id/confirm")
    async confirmBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: ConfirmBookingParamsRequest,
    ): Promise<ConfirmBookingResponse> {
        const result = await this.commandBus.execute(
            new ConfirmBookingCommand({ request: toConfirmBookingRequest(params), principal }),
        )
        return toConfirmBookingResponse(result)
    }

    /** Records the arrival of the customer. */
    @Post("bookings/:id/check-in")
    async checkInBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: CheckInBookingParamsRequest,
    ): Promise<CheckInBookingResponse> {
        const result = await this.commandBus.execute(
            new CheckInBookingCommand({ request: toCheckInBookingRequest(params), principal }),
        )
        return toCheckInBookingResponse(result)
    }

    /** Marks a booking done. */
    @Post("bookings/:id/done")
    async completeBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: CompleteBookingParamsRequest,
    ): Promise<CompleteBookingResponse> {
        const result = await this.commandBus.execute(
            new CompleteBookingCommand({ request: toCompleteBookingRequest(params), principal }),
        )
        return toCompleteBookingResponse(result)
    }

    /** Records that the customer did not come. */
    @Post("bookings/:id/no-show")
    async markNoShow(
        @CurrentPrincipal() principal: Principal,
        @Param() params: MarkNoShowParamsRequest,
    ): Promise<MarkNoShowResponse> {
        const result = await this.commandBus.execute(
            new MarkNoShowCommand({ request: toMarkNoShowRequest(params), principal }),
        )
        return toMarkNoShowResponse(result)
    }

    /** Cancels a booking. */
    @Post("bookings/:id/cancel")
    async cancelBooking(
        @CurrentPrincipal() principal: Principal,
        @Param() params: CancelBookingParamsRequest,
    ): Promise<CancelBookingResponse> {
        const result = await this.commandBus.execute(
            new CancelBookingCommand({ request: toCancelBookingRequest(params), principal }),
        )
        return toCancelBookingResponse(result)
    }
}
