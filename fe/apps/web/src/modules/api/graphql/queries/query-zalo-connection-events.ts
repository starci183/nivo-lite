import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ZaloConnectionEventsQuery, ZaloConnectionEventsQueryVariables } from "../__generated__/graphql"

/** The variables of the `zaloConnectionEvents` query. */
type QueryZaloConnectionEventsRequest = WireInput<ZaloConnectionEventsQueryVariables["input"]>

/** The response of the `zaloConnectionEvents` query: the typed payload straight from the back end contract. */
type QueryZaloConnectionEventsResponse = ZaloConnectionEventsQuery

const query1: TypedDocumentNode<
    QueryZaloConnectionEventsResponse,
    InputVariables<QueryZaloConnectionEventsRequest>
> = gql`
    query ZaloConnectionEvents($input: ListZaloEventsInput!) {
        zaloConnectionEvents(input: $input) {
            id
            kind
            outcome
            at
            who
            text
            reason
        }
    }
`

enum QueryZaloConnectionEvents {
    Query1 = "query1",
}

const queryMap: Record<
    QueryZaloConnectionEvents,
    TypedDocumentNode<QueryZaloConnectionEventsResponse, InputVariables<QueryZaloConnectionEventsRequest>>
> = {
    [QueryZaloConnectionEvents.Query1]: query1,
}

/** Apollo params for {@link queryZaloConnectionEvents}. */
interface QueryZaloConnectionEventsParams extends QueryParams<
    QueryZaloConnectionEvents,
    QueryZaloConnectionEventsRequest
> {
    request: QueryZaloConnectionEventsRequest
}

/** The live events of a Zalo OA connection. Rejects with the back end failure. */
export const queryZaloConnectionEvents = async ({
    query = QueryZaloConnectionEvents.Query1,
    request,
    signal,
}: QueryZaloConnectionEventsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
