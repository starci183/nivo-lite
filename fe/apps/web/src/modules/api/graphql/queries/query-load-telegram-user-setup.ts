import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLoadTelegramUserSetupArgs } from "../__generated__/schema"

/** The input of the `loadTelegramUserSetup` query. */
type QueryLoadTelegramUserSetupRequest = QueryLoadTelegramUserSetupArgs["input"]

/** The response of the `loadTelegramUserSetup` query. */
type QueryLoadTelegramUserSetupResponse = Pick<Query, "loadTelegramUserSetup">

const query1: TypedDocumentNode<
    QueryLoadTelegramUserSetupResponse,
    InputVariables<QueryLoadTelegramUserSetupRequest>
> = gql`
    query LoadTelegramUserSetup($input: LoadTelegramUserSetupInput!) {
        loadTelegramUserSetup(input: $input) {
            name
            status
            stage
            config {
                chats {
                    id
                    title
                    kind
                }
                sinceDays
            }
            everyMinutes
            consent
        }
    }
`

enum QueryLoadTelegramUserSetup {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLoadTelegramUserSetup,
    TypedDocumentNode<QueryLoadTelegramUserSetupResponse, InputVariables<QueryLoadTelegramUserSetupRequest>>
> = {
    [QueryLoadTelegramUserSetup.Query1]: query1,
}

/** Apollo params for {@link queryLoadTelegramUserSetup}. */
interface LoadTelegramUserSetupParams extends QueryParams<
    QueryLoadTelegramUserSetup,
    QueryLoadTelegramUserSetupRequest
> {
    request: QueryLoadTelegramUserSetupRequest
}

/** Where the personal Telegram wizard continues (resume). Rejects with the back end failure. */
export const queryLoadTelegramUserSetup = async ({
    query = QueryLoadTelegramUserSetup.Query1,
    request,
    signal,
}: LoadTelegramUserSetupParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
