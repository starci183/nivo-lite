import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryListTelegramChatsArgs } from "../__generated__/schema"

/** The input of the `listTelegramChats` query. */
type QueryListTelegramChatsRequest = QueryListTelegramChatsArgs["input"]

/** The response of the `listTelegramChats` query. */
type QueryListTelegramChatsResponse = Pick<Query, "listTelegramChats">

const query1: TypedDocumentNode<QueryListTelegramChatsResponse, InputVariables<QueryListTelegramChatsRequest>> = gql`
    query ListTelegramChats($input: ListTelegramChatsInput!) {
        listTelegramChats(input: $input) {
            id
            title
            kind
            unread
        }
    }
`

enum QueryListTelegramChats {
    Query1 = "query1",
}

const queryMap: Record<
    QueryListTelegramChats,
    TypedDocumentNode<QueryListTelegramChatsResponse, InputVariables<QueryListTelegramChatsRequest>>
> = {
    [QueryListTelegramChats.Query1]: query1,
}

/** Apollo params for {@link queryListTelegramChats}. */
interface ListTelegramChatsParams extends QueryParams<QueryListTelegramChats, QueryListTelegramChatsRequest> {
    request: QueryListTelegramChatsRequest
}

/** The recent chats of a personal Telegram account. Rejects with the back end failure. */
export const queryListTelegramChats = async ({
    query = QueryListTelegramChats.Query1,
    request,
    signal,
}: ListTelegramChatsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
