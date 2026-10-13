import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBookingBoardQuery } from "../../application/get-booking-board.query"
import { toBookingBoardRequest, toBookingBoardType } from "./booking-board.mapper"
import { BookingBoardInput } from "./dto/booking-board.input"
import { BookingBoardType } from "./dto/booking-board.type"

@Resolver()
/** GraphQL door of the complete booking workbench. */
export class BookingBoardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the catalog, calendar, waitlist, staff and statistics for a workspace member. */
    @Query(() => BookingBoardType, { name: "bookingBoard" })
    async bookingBoard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { nullable: true }) input?: BookingBoardInput,
    ): Promise<BookingBoardType> {
        const result = await this.queryBus.execute(
            new GetBookingBoardQuery({ request: toBookingBoardRequest(workspaceId, input), principal }),
        )
        return toBookingBoardType(result)
    }
}
