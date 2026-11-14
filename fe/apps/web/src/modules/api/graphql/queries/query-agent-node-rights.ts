import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentNodeRightsQuery, AgentNodeRightsQueryVariables } from "../__generated__/graphql"

/** Generated input of the agentNodeRights query. */
type QueryAgentNodeRightsRequest = WireInput<AgentNodeRightsQueryVariables["input"]>

/** Generated response of the agentNodeRights query. */
type QueryAgentNodeRightsResponse = AgentNodeRightsQuery

type Document = TypedDocumentNode<QueryAgentNodeRightsResponse, InputVariables<QueryAgentNodeRightsRequest>>

const query1: Document = gql`
    query AgentNodeRights($input: GetAgentNodeRightsInput!) {
        agentNodeRights(input: $input) {
            agentId
            accounts {
                connectionId
                provider
                kind
                name
                stepsUsing
                operations {
                    ...AgentNodeRightOperationFields
                }
            }
            rows {
                connectionId
                mode
                workflowId
                workflowKey
                workflowName
                nodeKey
                step
                stepTitle {
                    vi
                    en
                }
                operation {
                    ...AgentNodeRightOperationFields
                }
            }
        }
    }

    fragment AgentNodeRightOperationFields on NodeRightOperationType {
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
`

enum QueryAgentNodeRightsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentNodeRightsDocument, Document> = {
    [QueryAgentNodeRightsDocument.Query1]: query1,
}

type QueryAgentNodeRightsParams = QueryParams<QueryAgentNodeRightsDocument, QueryAgentNodeRightsRequest> & {
    request: QueryAgentNodeRightsRequest
}

/**
 * One agent's node rights: the accounts it is attached to (with what each provider offers, the node panel's choices), the read-only
 * roll-up of what its steps call, and whether node rights decide in this workspace yet. Rejects with the back end failure.
 */
export const queryAgentNodeRights = async ({
    query = QueryAgentNodeRightsDocument.Query1,
    request,
    signal,
}: QueryAgentNodeRightsParams): Promise<ApolloClient.QueryResult<QueryAgentNodeRightsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
