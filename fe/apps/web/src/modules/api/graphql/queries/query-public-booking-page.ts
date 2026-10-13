import type { PublicBookingPageQuery, PublicBookingPageQueryVariables } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"

/** The input of the `publicBookingPage` query. */
type QueryPublicBookingPageRequest = WireInput<PublicBookingPageQueryVariables["input"]>

const query1 = gql`
    query PublicBookingPage($input: PublicBookingPageInput!) {
        publicBookingPage(input: $input) {
            address
            note
            services {
                description
                durationMin
                id
                name
                priceVnd
            }
            shop
            slug
            timezone
        }
    }
`

enum QueryPublicBookingPage {
    Query1 = "query1",
}

const queryMap: Record<QueryPublicBookingPage, DocumentNode> = {
    [QueryPublicBookingPage.Query1]: query1,
}

/** Apollo params for {@link queryPublicBookingPage}. */
type QueryPublicBookingPageParams = QueryParams<QueryPublicBookingPage, QueryPublicBookingPageRequest> & {
    request: QueryPublicBookingPageRequest
}

/** The public booking page of one shop slug (anonymous: no token, no workspace). */
export const queryPublicBookingPage = async ({
    query = QueryPublicBookingPage.Query1,
    request,
    signal,
}: QueryPublicBookingPageParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.query<PublicBookingPageQuery, InputVariables<QueryPublicBookingPageRequest>>({
        query: queryMap[query],
        variables: { input: request },
    })
}
