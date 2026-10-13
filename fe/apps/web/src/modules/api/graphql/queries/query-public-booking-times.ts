import type { PublicBookingTimesQuery } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryPublicBookingTimesRequest } from "./types/public-booking-times"

const query1 = gql`
    query PublicBookingTimes($input: PublicBookingTimesInput!) {
        publicBookingTimes(input: $input) {
            times
        }
    }
`

enum QueryPublicBookingTimes {
    Query1 = "query1",
}

const queryMap: Record<QueryPublicBookingTimes, DocumentNode> = {
    [QueryPublicBookingTimes.Query1]: query1,
}

/** Apollo params for {@link queryPublicBookingTimes}. */
type QueryPublicBookingTimesParams = QueryParams<QueryPublicBookingTimes, QueryPublicBookingTimesRequest> & {
    request: QueryPublicBookingTimesRequest
}

/** The free start times of one service on one day of the public booking page. */
export const queryPublicBookingTimes = async ({
    query = QueryPublicBookingTimes.Query1,
    request,
    signal,
}: QueryPublicBookingTimesParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query<PublicBookingTimesQuery, InputVariables<QueryPublicBookingTimesRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
