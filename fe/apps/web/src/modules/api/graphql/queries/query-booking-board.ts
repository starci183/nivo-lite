import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryBookingBoardRequest, QueryBookingBoardResponse } from "./types/booking-board"

const query1 = gql`
    query BookingBoard($input: BookingBoardInput) {
        bookingBoard(input: $input) {
            bookings { checkedIn conflictNote customer date depositStatus depositVnd endClock endMin endMs feeVnd holdsSlot id leadId note party phone priceVnd reschedules resourceId service serviceId source startClock startMin startMs status }
            exceptions { closed date end id note resourceId start }
            figures { bookingsToday depositsPending depositsPendingVnd finished30d noShowPct30d utilisationPct }
            from
            hours { end resourceId start weekday }
            nowMs
            resources { active capacity color id kind name sort staffId }
            services { active bufferMin description durationMin followupDays id name priceVnd resourceKind }
            settings { address autoConfirm cancelWindowHours depositPct handoffOrder lateCancelFeePct maxAdvanceDays minLeadMin noShowFeeVnd publicEnabled publicNote publicSlug reminderHours slotStepMin timezone }
            staff { id name }
            stats { byResource { bookedMin name openMin pct resourceId } byStatus { count status } doneRevenueVnd noShowPct total }
            timezone
            to
            today
            waitlist { customer fromMs id party phone service status toMs }
        }
    }
`

export enum QueryBookingBoard {
    Query1 = "query1",
}

const queryMap: Record<QueryBookingBoard, DocumentNode> = {
    [QueryBookingBoard.Query1]: query1,
}

/** Apollo params for {@link queryBookingBoard}. */
export type QueryBookingBoardParams = QueryParams<QueryBookingBoard, QueryBookingBoardRequest>

/** The booking workbench board of one range of dates (an empty input answers the current week of the workspace timezone). */
export const queryBookingBoard = async ({ query = QueryBookingBoard.Query1, request, signal }: QueryBookingBoardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query<QueryBookingBoardResponse, InputVariables<QueryBookingBoardRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
