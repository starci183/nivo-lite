import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryOfficeMessagesArgs } from "../__generated__/schema"

/** The input of the `officeMessages` query. */
export type QueryOfficeMessagesRequest = QueryOfficeMessagesArgs["input"]

type QueryOfficeMessagesResponse = Pick<Query, "officeMessages">

const query1: TypedDocumentNode<QueryOfficeMessagesResponse, InputVariables<QueryOfficeMessagesRequest>> = gql`
    query OfficeMessages($input: ListOfficeMessagesInput!) {
        officeMessages(input: $input) {
            messages {
                agent_id
                author_kind
                author_name
                body
                created_at
                id
                lead_id
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
