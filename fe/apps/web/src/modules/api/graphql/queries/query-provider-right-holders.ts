import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ProviderRightHoldersQuery, ProviderRightHoldersQueryVariables } from "../__generated__/graphql"

/** Generated input of the providerRightHolders query. */
type QueryProviderRightHoldersRequest = WireInput<ProviderRightHoldersQueryVariables["input"]>

/** Generated response of the providerRightHolders query. */
type QueryProviderRightHoldersResponse = ProviderRightHoldersQuery

type Document = TypedDocumentNode<QueryProviderRightHoldersResponse, InputVariables<QueryProviderRightHoldersRequest>>

const query1: Document = gql`
    query ProviderRightHolders($input: GetProviderRightHoldersInput!) {
        providerRightHolders(input: $input) {
            connectionId
            provider
            counts {
                all
                held
                unheld
                writes
            }
            tools {
                open
                operation {
                    id
                    kind
                    method
                    path
                    effect
                    title {
                        vi
                        en
                    }
                }
                holders {
                    agentId
                    agentName
                    workflowId
                    workflowKey
                    workflowName
                    nodeKey
                    step
                    stepTitle {
                        vi
                        en
                    }
                    mode
                }
            }
            screens {
                name
                everyMember
                summary {
                    vi
                    en
                }
            }
            triggers {
                name
                summary {
                    vi
                    en
                }
                holders {
                    agentId
                    agentName
                    role
                    workflowId
                    workflowKey
                    workflowName
                    nodeKey
                    step
                    stepTitle {
                        vi
                        en
                    }
                }
            }
        }
    }
`

enum QueryProviderRightHoldersDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderRightHoldersDocument, Document> = {
    [QueryProviderRightHoldersDocument.Query1]: query1,
}

type QueryProviderRightHoldersParams = QueryParams<QueryProviderRightHoldersDocument, QueryProviderRightHoldersRequest> & {
    request: QueryProviderRightHoldersRequest
}

/**
 * Who holds each right of one connected account, down to agent, workflow and step (read-only), the screen and trigger rights, and
 * the server counts of the filter tabs. Rejects with the back end failure.
 */
export const queryProviderRightHolders = async ({
    query = QueryProviderRightHoldersDocument.Query1,
    request,
    signal,
}: QueryProviderRightHoldersParams): Promise<ApolloClient.QueryResult<QueryProviderRightHoldersResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
