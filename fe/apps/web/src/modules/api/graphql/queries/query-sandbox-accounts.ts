import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxAccountsQuery } from "../__generated__/graphql"

/** The response of the `sandboxAccounts` query: the typed payload straight from the back end contract. */
type QuerySandboxAccountsResponse = SandboxAccountsQuery

type Document = TypedDocumentNode<QuerySandboxAccountsResponse>

const query1: Document = gql`
    query SandboxAccounts {
        sandboxAccounts {
            id
            provider
            name
            status
            createdAt
            agents {
                id
                label
            }
        }
    }
`

enum QuerySandboxAccounts {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxAccounts, Document> = { [QuerySandboxAccounts.Query1]: query1 }

/** Apollo params for {@link querySandboxAccounts}. */
type QuerySandboxAccountsParams = QueryParams<QuerySandboxAccounts>

/** Reads the sandbox accounts of the workspace (owner and manager); rejects with the back end failure. */
export const querySandboxAccounts = async ({
    query = QuerySandboxAccounts.Query1,
    signal,
}: QuerySandboxAccountsParams = {}): Promise<ApolloClient.QueryResult<QuerySandboxAccountsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
