import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SepayConnectionEventsQuery, SepayConnectionEventsQueryVariables } from "../__generated__/graphql"

/** The variables of the `sepayConnectionEvents` query. */
type QuerySepayConnectionEventsRequest = WireInput<SepayConnectionEventsQueryVariables["input"]>

/** The response of the `sepayConnectionEvents` query: the typed payload straight from the back end contract. */
type QuerySepayConnectionEventsResponse = SepayConnectionEventsQuery

const query1: TypedDocumentNode<
    QuerySepayConnectionEventsResponse,
    InputVariables<QuerySepayConnectionEventsRequest>
> = gql`
    query SepayConnectionEvents($input: ListSepayEventsInput!) {
        sepayConnectionEvents(input: $input) {
            id
            at
            outcome
            kind
            amountVnd
            providerEventId
            environment
        }
    }
`

enum QuerySepayConnectionEvents {
    Query1 = "query1",
}

const queryMap: Record<
    QuerySepayConnectionEvents,
    TypedDocumentNode<QuerySepayConnectionEventsResponse, InputVariables<QuerySepayConnectionEventsRequest>>
> = {
    [QuerySepayConnectionEvents.Query1]: query1,
}

/** Apollo params for {@link querySepayConnectionEvents}. */
interface QuerySepayConnectionEventsParams extends QueryParams<
    QuerySepayConnectionEvents,
    QuerySepayConnectionEventsRequest
> {
    request: QuerySepayConnectionEventsRequest
}

/** The newest webhook deliveries of one SePay connection. Rejects with the back end failure. */
export const querySepayConnectionEvents = async ({
    query = QuerySepayConnectionEvents.Query1,
    request,
    signal,
}: QuerySepayConnectionEventsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
