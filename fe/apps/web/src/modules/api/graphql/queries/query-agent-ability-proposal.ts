import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentAbilityProposalQuery, AgentAbilityProposalQueryVariables } from "../__generated__/graphql"

/** Generated input of the agentAbilityProposal query. */
type QueryAgentAbilityProposalRequest = WireInput<AgentAbilityProposalQueryVariables["input"]>

/** Generated response of the agentAbilityProposal query. */
type QueryAgentAbilityProposalResponse = AgentAbilityProposalQuery

type Document = TypedDocumentNode<QueryAgentAbilityProposalResponse, InputVariables<QueryAgentAbilityProposalRequest>>

const query1: Document = gql`
    query AgentAbilityProposal($input: AgentAbilityProposalInput!) {
        agentAbilityProposal(input: $input) {
            provider
            connectionId
            accountLabel
            connected
            abilities {
                id
                mode
            }
        }
    }
`

enum QueryAgentAbilityProposalDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentAbilityProposalDocument, Document> = {
    [QueryAgentAbilityProposalDocument.Query1]: query1,
}

type QueryAgentAbilityProposalParams = QueryParams<
    QueryAgentAbilityProposalDocument,
    QueryAgentAbilityProposalRequest
> & { request: QueryAgentAbilityProposalRequest }

/** One line per connected account of the providers a template names, with the abilities it pre-ticks, and a line per named provider not connected. Rejects with the back end failure. */
export const queryAgentAbilityProposal = async ({
    query = QueryAgentAbilityProposalDocument.Query1,
    request,
    signal,
}: QueryAgentAbilityProposalParams): Promise<ApolloClient.QueryResult<QueryAgentAbilityProposalResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
