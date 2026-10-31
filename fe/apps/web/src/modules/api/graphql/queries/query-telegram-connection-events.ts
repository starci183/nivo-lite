import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { TelegramConnectionEventsQuery, TelegramConnectionEventsQueryVariables } from "../__generated__/graphql"

/** The variables of the `telegramEvents` query. */
type QueryTelegramConnectionEventsRequest = WireInput<TelegramConnectionEventsQueryVariables["input"]>

/** The response of the `telegramEvents` query: the typed payload straight from the back end contract. */
type QueryTelegramConnectionEventsResponse = TelegramConnectionEventsQuery

const query1: TypedDocumentNode<
    QueryTelegramConnectionEventsResponse,
    InputVariables<QueryTelegramConnectionEventsRequest>
> = gql`
    query TelegramConnectionEvents($input: ListTelegramEventsInput!) {
        telegramEvents(input: $input) {
            id
            kind
            outcome
            at
            who
            reason
        }
    }
`

enum QueryTelegramConnectionEvents {
    Query1 = "query1",
}

const queryMap: Record<
    QueryTelegramConnectionEvents,
    TypedDocumentNode<QueryTelegramConnectionEventsResponse, InputVariables<QueryTelegramConnectionEventsRequest>>
> = {
    [QueryTelegramConnectionEvents.Query1]: query1,
}

/** Apollo params for {@link queryTelegramConnectionEvents}. */
interface QueryTelegramConnectionEventsParams extends QueryParams<
    QueryTelegramConnectionEvents,
    QueryTelegramConnectionEventsRequest
> {
    request: QueryTelegramConnectionEventsRequest
}

/** The live events of a Telegram bot connection, newest first and without any message text. Rejects with the back end failure. */
export const queryTelegramConnectionEvents = async ({
    query = QueryTelegramConnectionEvents.Query1,
    request,
    signal,
}: QueryTelegramConnectionEventsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
