import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { TelegramUserReadyQuery } from "../__generated__/graphql"

/** The response of the `telegramUserReady` query. */
type QueryTelegramUserReadyResponse = TelegramUserReadyQuery

const query1: TypedDocumentNode<QueryTelegramUserReadyResponse> = gql`
    query TelegramUserReady {
        telegramUserReady {
            configured
        }
    }
`

enum QueryTelegramUserReady {
    Query1 = "query1",
}

const queryMap: Record<QueryTelegramUserReady, TypedDocumentNode<QueryTelegramUserReadyResponse>> = {
    [QueryTelegramUserReady.Query1]: query1,
}

/** Apollo params for {@link queryTelegramUserReady}. */
type TelegramUserReadyParams = QueryParams<QueryTelegramUserReady>

/** Whether personal Telegram login is available on this deployment. Rejects with the back end failure. */
export const queryTelegramUserReady = async ({
    query = QueryTelegramUserReady.Query1,
    signal,
}: TelegramUserReadyParams = {}): Promise<ApolloClient.QueryResult<QueryTelegramUserReadyResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
