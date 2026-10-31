import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { TelegramConnectionPageQuery, TelegramConnectionPageQueryVariables } from "../__generated__/graphql"

/** The variables of the `telegramPage` query. */
type QueryTelegramConnectionPageRequest = WireInput<TelegramConnectionPageQueryVariables["input"]>

/** The response of the `telegramPage` query: the typed payload straight from the back end contract. */
type QueryTelegramConnectionPageResponse = TelegramConnectionPageQuery

const query1: TypedDocumentNode<
    QueryTelegramConnectionPageResponse,
    InputVariables<QueryTelegramConnectionPageRequest>
> = gql`
    query TelegramConnectionPage($input: GetTelegramPageInput!) {
        telegramPage(input: $input) {
            id
            name
            status
            healthy
            botUsername
            webhookUrl
            lastError
            lastEventAt
            agentIds
        }
    }
`

enum QueryTelegramConnectionPage {
    Query1 = "query1",
}

const queryMap: Record<
    QueryTelegramConnectionPage,
    TypedDocumentNode<QueryTelegramConnectionPageResponse, InputVariables<QueryTelegramConnectionPageRequest>>
> = {
    [QueryTelegramConnectionPage.Query1]: query1,
}

/** Apollo params for {@link queryTelegramConnectionPage}. */
interface QueryTelegramConnectionPageParams extends QueryParams<
    QueryTelegramConnectionPage,
    QueryTelegramConnectionPageRequest
> {
    request: QueryTelegramConnectionPageRequest
}

/** The page of a Telegram bot connection (owner or manager). Rejects with the back end failure. */
export const queryTelegramConnectionPage = async ({
    query = QueryTelegramConnectionPage.Query1,
    request,
    signal,
}: QueryTelegramConnectionPageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
