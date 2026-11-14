import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CrmConnectionQuery, CrmConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `crmConnection` query. */
type QueryCrmConnectionRequest = WireInput<CrmConnectionQueryVariables["input"]>

/** The response of the `crmConnection` query. */
type QueryCrmConnectionResponse = CrmConnectionQuery

const query1: TypedDocumentNode<QueryCrmConnectionResponse, InputVariables<QueryCrmConnectionRequest>> = gql`
    query CrmConnection($input: LoadCrmConnectionInput!) {
        crmConnection(input: $input) {
            crmId
            baseUrl
            swaggerUrl
            authType
            authName
            hasSecret
            pin {
                connector
                swaggerUrl
                documentSha256
                pinnedAt
                live
                needed {
                    op
                    state
                    method
                    path
                    effect
                }
                others {
                    op
                    method
                    path
                }
            }
        }
    }
`

enum QueryCrmConnectionKind {
    Query1 = "query1",
}

const queryMap: Record<
    QueryCrmConnectionKind,
    TypedDocumentNode<QueryCrmConnectionResponse, InputVariables<QueryCrmConnectionRequest>>
> = {
    [QueryCrmConnectionKind.Query1]: query1,
}

/** Apollo params for {@link queryCrmConnection}. */
interface QueryCrmConnectionParams extends QueryParams<QueryCrmConnectionKind, QueryCrmConnectionRequest> {
    request: QueryCrmConnectionRequest
}

/** Reads a saved CRM connection for the provider page (never the key). Rejects with the back end failure. */
export const queryCrmConnection = async ({
    query = QueryCrmConnectionKind.Query1,
    request,
    signal,
}: QueryCrmConnectionParams): Promise<ApolloClient.QueryResult<QueryCrmConnectionResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
