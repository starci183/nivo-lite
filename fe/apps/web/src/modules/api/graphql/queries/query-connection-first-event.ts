import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryConnectionFirstEventArgs } from "../__generated__/schema"

/** The variables of the `connectionFirstEvent` query. */
export type QueryConnectionFirstEventRequest = QueryConnectionFirstEventArgs["input"]

/** The response of the `connectionFirstEvent` query: the typed payload straight from the back end contract. */
type QueryConnectionFirstEventResponse = Pick<Query, "connectionFirstEvent">

const query1: TypedDocumentNode<
    QueryConnectionFirstEventResponse,
    InputVariables<QueryConnectionFirstEventRequest>
> = gql`
    query ConnectionFirstEvent($input: GetConnectionFirstEventInput!) {
        connectionFirstEvent(input: $input) {
            status
            firstEvent {
                amount
                at
                content
            }
        }
    }
`

enum QueryConnectionFirstEvent {
    Query1 = "query1",
}

const queryMap: Record<
    QueryConnectionFirstEvent,
    TypedDocumentNode<QueryConnectionFirstEventResponse, InputVariables<QueryConnectionFirstEventRequest>>
> = {
    [QueryConnectionFirstEvent.Query1]: query1,
}

/** Apollo params for {@link queryConnectionFirstEvent}. */
interface QueryConnectionFirstEventParams extends QueryParams<
    QueryConnectionFirstEvent,
    QueryConnectionFirstEventRequest
> {
    request: QueryConnectionFirstEventRequest
}

/** Whether a connection already received its first event. Rejects with the back end failure. */
export const queryConnectionFirstEvent = async ({
    query = QueryConnectionFirstEvent.Query1,
    request,
    signal,
}: QueryConnectionFirstEventParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
