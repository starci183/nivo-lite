import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { MoneyConnectionQuery, MoneyConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `moneyConnection` query. */
type QueryMoneyConnectionRequest = WireInput<MoneyConnectionQueryVariables["input"]>

/** The response of the `moneyConnection` query: the typed payload straight from the back end contract. */
type QueryMoneyConnectionResponse = MoneyConnectionQuery

const query1: TypedDocumentNode<QueryMoneyConnectionResponse, InputVariables<QueryMoneyConnectionRequest>> = gql`
    query MoneyConnection($input: GetMoneyConnectionInput!) {
        moneyConnection(input: $input) {
            id
            provider
            name
            environment
            status
            webhookUrl
            apiKey
            bankCode
            account
            holder
            credentialsSaved
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum QueryMoneyConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryMoneyConnection,
    TypedDocumentNode<QueryMoneyConnectionResponse, InputVariables<QueryMoneyConnectionRequest>>
> = {
    [QueryMoneyConnection.Query1]: query1,
}

/** Apollo params for {@link queryMoneyConnection}. */
interface QueryMoneyConnectionParams extends QueryParams<QueryMoneyConnection, QueryMoneyConnectionRequest> {
    request: QueryMoneyConnectionRequest
}

/** The bank and payment wizard view of a connection (resume). Rejects with the back end failure. */
export const queryMoneyConnection = async ({
    query = QueryMoneyConnection.Query1,
    request,
    signal,
}: QueryMoneyConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
