import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SepayConnectionQuery, SepayConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `sepayConnection` query. */
type QuerySepayConnectionRequest = WireInput<SepayConnectionQueryVariables["input"]>

/** The response of the `sepayConnection` query: the typed payload straight from the back end contract. */
type QuerySepayConnectionResponse = SepayConnectionQuery

const query1: TypedDocumentNode<QuerySepayConnectionResponse, InputVariables<QuerySepayConnectionRequest>> = gql`
    query SepayConnection($input: GetSepayConnectionInput!) {
        sepayConnection(input: $input) {
            id
            name
            status
            environment
            lastError
            bankCode
            bank
            accountMasked
            hasFullAccount
            holder
            webhookUrl
            apiKeyMasked
            pingSeenAt
            transactionSeenAt
            health {
                lastWebhookAt
                validCount
                totalCount
                duplicateCount
            }
            agentIds
        }
    }
`

enum QuerySepayConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QuerySepayConnection,
    TypedDocumentNode<QuerySepayConnectionResponse, InputVariables<QuerySepayConnectionRequest>>
> = {
    [QuerySepayConnection.Query1]: query1,
}

/** Apollo params for {@link querySepayConnection}. */
interface QuerySepayConnectionParams extends QueryParams<QuerySepayConnection, QuerySepayConnectionRequest> {
    request: QuerySepayConnectionRequest
}

/** The page read model of one SePay connection. Rejects with the back end failure. */
export const querySepayConnection = async ({
    query = QuerySepayConnection.Query1,
    request,
    signal,
}: QuerySepayConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
