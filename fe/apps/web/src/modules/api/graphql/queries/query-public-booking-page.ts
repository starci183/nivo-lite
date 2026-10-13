import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { QueryPublicBookingPageRequest, QueryPublicBookingPageResponse } from "./types/public-booking-page"

const query1 = gql`
    query PublicBookingPage($input: PublicBookingPageInput!) {
        publicBookingPage(input: $input) {
            address note services { description durationMin id name priceVnd } shop slug timezone
        }
    }
`

export enum QueryPublicBookingPage {
    Query1 = "query1",
}

const queryMap: Record<QueryPublicBookingPage, DocumentNode> = {
    [QueryPublicBookingPage.Query1]: query1,
}

/** Apollo params for {@link queryPublicBookingPage}. */
export type QueryPublicBookingPageParams = QueryParams<QueryPublicBookingPage, QueryPublicBookingPageRequest> & { request: QueryPublicBookingPageRequest }

/** The public booking page of one shop slug (anonymous: no token, no workspace). */
export const queryPublicBookingPage = async ({ query = QueryPublicBookingPage.Query1, request, signal }: QueryPublicBookingPageParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query<QueryPublicBookingPageResponse, InputVariables<QueryPublicBookingPageRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
