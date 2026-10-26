import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { OfficeMessagesQuery, OfficeMessagesQueryVariables } from "../__generated__/graphql"

/** The input of the `officeMessages` query. */
export type QueryOfficeMessagesRequest = WireInput<OfficeMessagesQueryVariables["input"]>

type QueryOfficeMessagesResponse = OfficeMessagesQuery

const query1: TypedDocumentNode<QueryOfficeMessagesResponse, InputVariables<QueryOfficeMessagesRequest>> = gql`
    query OfficeMessages($input: ListOfficeMessagesInput!) {
        officeMessages(input: $input) {
            messages {
                agent_id
                author_kind
                author_name
                author_user_id
                body
                card_json
                card_state
                created_at
                id
                lead_id
                room
                staff_id
                work_item_id
            }
            next {
                createdAt
                id
            }
        }
    }
`

enum QueryOfficeMessages {
    Query1 = "query1",
}

const queryMap: Record<
    QueryOfficeMessages,
    TypedDocumentNode<QueryOfficeMessagesResponse, InputVariables<QueryOfficeMessagesRequest>>
> = {
    [QueryOfficeMessages.Query1]: query1,
}

type QueryOfficeMessagesParams = QueryParams<QueryOfficeMessages, QueryOfficeMessagesRequest> & {
    request: QueryOfficeMessagesRequest
}

/** The back end `officeMessages` query. Rejects with the back end failure (message localized by the server). */
export const queryOfficeMessages = async ({
    query = QueryOfficeMessages.Query1,
    request,
    signal,
}: QueryOfficeMessagesParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
