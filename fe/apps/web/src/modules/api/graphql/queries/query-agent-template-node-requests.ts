import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentTemplateNodeRequestsQuery, AgentTemplateNodeRequestsQueryVariables } from "../__generated__/graphql"

/** Generated input of the agentTemplateNodeRequests query. */
type QueryAgentTemplateNodeRequestsRequest = WireInput<AgentTemplateNodeRequestsQueryVariables["input"]>

/** Generated response of the agentTemplateNodeRequests query. */
type QueryAgentTemplateNodeRequestsResponse = AgentTemplateNodeRequestsQuery

type Document = TypedDocumentNode<
    QueryAgentTemplateNodeRequestsResponse,
    InputVariables<QueryAgentTemplateNodeRequestsRequest>
>

const query1: Document = gql`
    query AgentTemplateNodeRequests($input: GetAgentTemplateNodeRequestsInput!) {
        agentTemplateNodeRequests(input: $input) {
            templateId
            version
            count
            askCount
            rights {
                nodeKey
                kind
                provider
                operation
                mode
            }
        }
    }
`

enum QueryAgentTemplateNodeRequestsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentTemplateNodeRequestsDocument, Document> = {
    [QueryAgentTemplateNodeRequestsDocument.Query1]: query1,
}

type QueryAgentTemplateNodeRequestsParams = QueryParams<
    QueryAgentTemplateNodeRequestsDocument,
    QueryAgentTemplateNodeRequestsRequest
> & {
    request: QueryAgentTemplateNodeRequestsRequest
}

/**
 * What ONE workflow template's steps ask for on accounts before it is installed (one row per node, account entry and operation), with
 * the counts the create dialog shows (the rights count and the ask-first count, as the dialog words them). Rejects with the back end failure.
 */
export const queryAgentTemplateNodeRequests = async ({
    query = QueryAgentTemplateNodeRequestsDocument.Query1,
    request,
    signal,
}: QueryAgentTemplateNodeRequestsParams): Promise<ApolloClient.QueryResult<QueryAgentTemplateNodeRequestsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
