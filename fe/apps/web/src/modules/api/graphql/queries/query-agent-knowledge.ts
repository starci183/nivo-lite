import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentKnowledgeQuery, AgentKnowledgeQueryVariables } from "../__generated__/graphql"

/** The input of the `agentKnowledge` query. */
export type QueryAgentKnowledgeRequest = WireInput<AgentKnowledgeQueryVariables["input"]>

type QueryAgentKnowledgeResponse = AgentKnowledgeQuery

const query1: TypedDocumentNode<QueryAgentKnowledgeResponse, InputVariables<QueryAgentKnowledgeRequest>> = gql`
    query AgentKnowledge($input: AgentIdInput!) {
        agentKnowledge(input: $input) {
            agentId
            audience
            documents {
                approvedFacts
                id
                isRead
                kind
                layer
                title
                updatedAt
                waitingFacts
            }
            installationId
            layers {
                approvedFacts
                documents
                isRead
                layer
                totalFacts
            }
            module
            name
            ownFacts {
                id
                isApproved
                label
                value
            }
            waitingFacts
        }
    }
`

enum QueryAgentKnowledge {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentKnowledge,
    TypedDocumentNode<QueryAgentKnowledgeResponse, InputVariables<QueryAgentKnowledgeRequest>>
> = {
    [QueryAgentKnowledge.Query1]: query1,
}

type QueryAgentKnowledgeParams = QueryParams<QueryAgentKnowledge, QueryAgentKnowledgeRequest> & {
    request: QueryAgentKnowledgeRequest
}

/** The back end `agentKnowledge` query: what one agent reads of the shared knowledge. Rejects with the back end failure (message localized by the server). */
export const queryAgentKnowledge = async ({
    query = QueryAgentKnowledge.Query1,
    request,
    signal,
}: QueryAgentKnowledgeParams): Promise<ApolloClient.QueryResult<QueryAgentKnowledgeResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
