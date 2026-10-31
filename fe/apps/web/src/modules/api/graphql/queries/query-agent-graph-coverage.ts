import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentGraphCoverageQuery, AgentGraphCoverageQueryVariables } from "../__generated__/graphql"

/** The input of the `agentGraphCoverage` query. */
export type QueryAgentGraphCoverageRequest = WireInput<AgentGraphCoverageQueryVariables["input"]>

type QueryAgentGraphCoverageResponse = AgentGraphCoverageQuery

const query1: TypedDocumentNode<QueryAgentGraphCoverageResponse, InputVariables<QueryAgentGraphCoverageRequest>> = gql`
    query AgentGraphCoverage($input: ListAgentGraphCoverageInput!) {
        agentGraphCoverage(input: $input) {
            branchKey
            covered
            excluded {
                name
                reason
            }
            nodeKey
            top
            approvers
        }
    }
`

enum QueryAgentGraphCoverage {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentGraphCoverage,
    TypedDocumentNode<QueryAgentGraphCoverageResponse, InputVariables<QueryAgentGraphCoverageRequest>>
> = {
    [QueryAgentGraphCoverage.Query1]: query1,
}

type QueryAgentGraphCoverageParams = QueryParams<QueryAgentGraphCoverage, QueryAgentGraphCoverageRequest> & {
    request: QueryAgentGraphCoverageRequest
}

/** The back end `agentGraphCoverage` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraphCoverage = async ({
    query = QueryAgentGraphCoverage.Query1,
    request,
    signal,
}: QueryAgentGraphCoverageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
